import { describe, expect, it } from 'vitest';
import { BatchLru, batchForLevel } from '../src/data';
import type { Manifest } from '../src/types';

const manifest: Manifest = {
  dataVersion: 'v',
  totalLevels: 120,
  batchSize: 50,
  batches: [
    { index: 0, file: 'batch-000.aaaaaa.json', sha256: 'a', levelIds: [1, 50] },
    { index: 1, file: 'batch-001.bbbbbb.json', sha256: 'b', levelIds: [51, 100] },
    { index: 2, file: 'batch-002.cccccc.json', sha256: 'c', levelIds: [101, 120] },
  ],
};

describe('batchForLevel', () => {
  it('maps level ids to their batch', () => {
    expect(batchForLevel(manifest, 1).index).toBe(0);
    expect(batchForLevel(manifest, 50).index).toBe(0);
    expect(batchForLevel(manifest, 51).index).toBe(1);
    expect(batchForLevel(manifest, 120).index).toBe(2);
    expect(() => batchForLevel(manifest, 121)).toThrow();
  });
});

describe('BatchLru', () => {
  const batch = { levels: [] };

  it('holds at most its capacity, evicting the least recently used', () => {
    const lru = new BatchLru(3);
    lru.put(0, batch);
    lru.put(1, batch);
    lru.put(2, batch);
    lru.get(0); // touch 0 so 1 becomes the eviction candidate
    lru.put(3, batch);
    expect(lru.size).toBe(3);
    expect(lru.has(1)).toBe(false);
    expect(lru.has(0)).toBe(true);
    expect(lru.has(2)).toBe(true);
    expect(lru.has(3)).toBe(true);
  });
});
