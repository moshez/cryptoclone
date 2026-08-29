import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

export interface FixtureLevel {
  id: number;
  tier: number;
  cipher: number[];
  solution: string;
  revealed: [number, string][];
  lockedIndices: number[];
  halfLocked?: Record<string, 'left' | 'right'>;
  attribution: { author: string; work: string; year: number; essay: string };
}

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/data');

export function fixtureManifest() {
  return JSON.parse(readFileSync(join(fixtureDir, 'manifest.json'), 'utf-8'));
}

export function fixtureLevels(): FixtureLevel[] {
  const files = readdirSync(fixtureDir).filter((f) => f.startsWith('batch-')).sort();
  return files.flatMap(
    (f) => JSON.parse(readFileSync(join(fixtureDir, f), 'utf-8')).levels as FixtureLevel[],
  );
}

export function fixtureLevel(id: number): FixtureLevel {
  const level = fixtureLevels().find((l) => l.id === id);
  if (!level) throw new Error(`no fixture level ${id}`);
  return level;
}

/** Solve by assigning every distinct unrevealed symbol via the on-screen
 * keyboard: select a cell of the symbol, then press its letter key. */
export async function solveLevel(page: Page, level: FixtureLevel): Promise<void> {
  const revealed = new Set(level.revealed.map(([num]) => num));
  const done = new Set<number>();
  for (let i = 0; i < level.cipher.length; i++) {
    const num = level.cipher[i];
    if (num === -1 || revealed.has(num) || done.has(num)) continue;
    if (level.lockedIndices.includes(i)) continue; // will fill via another cell
    done.add(num);
    await page.getByTestId(`cell-${i}`).click();
    await page.getByTestId(`key-${level.solution[i]}`).click();
  }
}

export async function gotoLevel(page: Page, id: number): Promise<void> {
  const input = page.getByTestId('level-input');
  await input.fill(String(id));
  await input.blur();
}

/** Wait until the service worker for this page's scope is active. */
export async function waitForServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg?.active;
  });
}
