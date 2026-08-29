import type { Batch, BatchInfo, Level, Manifest } from './types';

const BASE = import.meta.env.BASE_URL;

export const PREFETCH_WINDOW = 10;
export const LRU_CAPACITY = 3;
const RUNTIME_CACHE = 'runtime-v1';

/** Data responses are written to Cache Storage from the page as well as the
 * service worker: on the very first visit the page is not yet controlled,
 * and without this the first session would have no offline data. */
async function putInCacheStorage(url: string, response: Response): Promise<void> {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(url, response);
  } catch {
    // Cache Storage unavailable (e.g. private browsing); play on.
  }
}

async function fetchAndCache(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.ok && 'caches' in globalThis) {
    void putInCacheStorage(url, res.clone());
  }
  return res;
}

export async function fetchManifest(): Promise<Manifest> {
  const res = await fetchAndCache(`${BASE}data/manifest.json`);
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  return res.json();
}

export function batchForLevel(manifest: Manifest, levelId: number): BatchInfo {
  const info = manifest.batches.find(
    (b) => levelId >= b.levelIds[0] && levelId <= b.levelIds[1],
  );
  if (!info) throw new Error(`no batch contains level ${levelId}`);
  return info;
}

/** Decoded batches, most-recently-used last. Bounded so long sessions don't
 * hold the whole corpus in memory. */
export class BatchLru {
  private map = new Map<number, Batch>();

  constructor(private capacity: number = LRU_CAPACITY) {}

  get(index: number): Batch | undefined {
    const batch = this.map.get(index);
    if (batch) {
      this.map.delete(index);
      this.map.set(index, batch);
    }
    return batch;
  }

  put(index: number, batch: Batch): void {
    this.map.delete(index);
    this.map.set(index, batch);
    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value as number;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }

  has(index: number): boolean {
    return this.map.has(index);
  }
}

export class LevelStore {
  private lru = new BatchLru();
  private inflight = new Map<number, Promise<Batch>>();
  private prefetched = new Set<number>();

  constructor(readonly manifest: Manifest) {}

  private async loadBatch(info: BatchInfo): Promise<Batch> {
    const cached = this.lru.get(info.index);
    if (cached) return cached;
    let promise = this.inflight.get(info.index);
    if (!promise) {
      promise = fetchAndCache(`${BASE}data/${info.file}`)
        .then((res) => {
          if (!res.ok) throw new Error(`batch fetch failed: ${res.status}`);
          return res.json() as Promise<Batch>;
        })
        .finally(() => this.inflight.delete(info.index));
      this.inflight.set(info.index, promise);
    }
    const batch = await promise;
    this.lru.put(info.index, batch);
    return batch;
  }

  async getLevel(levelId: number): Promise<Level> {
    const info = batchForLevel(this.manifest, levelId);
    const batch = await this.loadBatch(info);
    const level = batch.levels.find((l) => l.id === levelId);
    if (!level) throw new Error(`level ${levelId} missing from ${info.file}`);
    this.maybePrefetch(levelId, info);
    return level;
  }

  /** Within the last PREFETCH_WINDOW levels of the current batch, warm the
   * next batch (at most one ahead) into Cache Storage via the service
   * worker. The response body is dropped here; decoding waits until the
   * batch is actually entered. */
  private maybePrefetch(levelId: number, info: BatchInfo): void {
    const next = this.manifest.batches.find((b) => b.index === info.index + 1);
    if (!next) return;
    if (levelId <= info.levelIds[1] - PREFETCH_WINDOW) return;
    if (this.lru.has(next.index) || this.prefetched.has(next.index)) return;
    this.prefetched.add(next.index);
    const init: RequestInit & { priority?: 'low' } = { priority: 'low' };
    fetchAndCache(`${BASE}data/${next.file}`, init).catch(() => {
      this.prefetched.delete(next.index);
    });
  }
}
