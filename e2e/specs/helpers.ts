import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

export interface FixtureLevel {
  id: number;
  tier: number;
  cipher: number[];
  solution: string;
  revealedIndices: number[];
  lockedIndices: number[];
  halfLocked?: Record<string, 'left' | 'right'>;
  attribution: { author: string; work: string; year: number; essay: string };
}

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/data');

export function fixtureManifest() {
  return JSON.parse(readFileSync(join(fixtureDir, 'manifest.json'), 'utf-8'));
}

export function fixtureLevels(): FixtureLevel[] {
  const files = readdirSync(fixtureDir)
    .filter((f) => f.startsWith('batch-'))
    .sort();
  return files.flatMap(
    (f) => JSON.parse(readFileSync(join(fixtureDir, f), 'utf-8')).levels as FixtureLevel[],
  );
}

export function fixtureLevel(id: number): FixtureLevel {
  const level = fixtureLevels().find((l) => l.id === id);
  if (!level) throw new Error(`no fixture level ${id}`);
  return level;
}

/** First letter-cell index that starts empty (not revealed, not locked). */
export function firstFillableCell(level: FixtureLevel): number {
  const revealed = new Set(level.revealedIndices);
  const i = level.cipher.findIndex(
    (num, idx) => num !== -1 && !revealed.has(idx) && !level.lockedIndices.includes(idx),
  );
  if (i === -1) throw new Error(`level ${level.id} has no fillable cell`);
  return i;
}

/** Solve by filling every empty cell individually via the on-screen
 * keyboard: nothing auto-fills, so each cell needs its own entry. Locked
 * cells are retried in later passes, once a neighbour has opened them. */
export async function solveLevel(page: Page, level: FixtureLevel): Promise<void> {
  const remaining = new Set<number>();
  const revealed = new Set(level.revealedIndices);
  level.cipher.forEach((num, i) => {
    if (num !== -1 && !revealed.has(i)) remaining.add(i);
  });
  while (remaining.size > 0) {
    let progressed = false;
    for (const i of [...remaining].sort((a, b) => a - b)) {
      const cell = page.getByTestId(`cell-${i}`);
      const cls = (await cell.getAttribute('class')) ?? '';
      if (cls.includes('cell-locked')) continue; // not reachable yet
      await cell.click();
      await page.getByTestId(`key-${level.solution[i]}`).click();
      remaining.delete(i);
      progressed = true;
    }
    if (!progressed) throw new Error(`level ${level.id}: locked cells never opened`);
  }
}

export async function gotoLevel(page: Page, id: number): Promise<void> {
  const input = page.getByTestId('level-input');
  await input.fill(String(id));
  await input.blur();
}

/** Wait until the service worker is activated AND controls this page.
 *
 * This must run in `page.evaluate`, which awaits the promise: an async
 * predicate handed to `waitForFunction` returns a Promise, which is truthy,
 * so such a wait resolves on the first poll without waiting for anything.
 * `reg.active` alone is also too early: it is set while the worker is still
 * activating, before `clients.claim()` has run, and a navigation made offline
 * before the page is controlled goes straight to the network and fails. */
export async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const worker = reg.active;
    if (!worker) throw new Error('serviceWorker.ready resolved without an active worker');
    await new Promise<void>((ok, fail) => {
      const check = () => {
        if (worker.state === 'activated') ok();
        else if (worker.state === 'redundant')
          fail(new Error('service worker became redundant'));
      };
      worker.addEventListener('statechange', check);
      check();
    });
    await new Promise<void>((ok) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => ok(), { once: true });
      if (navigator.serviceWorker.controller) ok();
    });
  });
}
