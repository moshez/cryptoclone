/** Invariants over the committed corpus (and the e2e fixture corpus): the
 * standing constraint is that nothing can reach /data without passing the
 * pipeline's gates, and this test enforces the observable consequences
 * rather than trusting convention. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { initialState, isCellLocked, withUnlocks } from '../src/game';
import { wordSpans } from '../src/game';
import type { Batch, Level, Manifest } from '../src/types';

const CORPORA = [
  resolve(__dirname, '../../data'),
  resolve(__dirname, '../../e2e/fixtures/data'),
];

const ALLOWED = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZ.,;:'!?—- ".split(''));

function loadManifest(dir: string): Manifest {
  return JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf-8'));
}

/** Every locked cell must become reachable when the puzzle is (correctly)
 * filled in: give the sim the full solution as assignments and check no
 * cell stays locked. */
function allLockedReachable(level: Level): boolean {
  const assignments: Record<number, string> = {};
  level.cipher.forEach((num, i) => {
    if (num !== -1) assignments[num] = level.solution[i];
  });
  const state = withUnlocks(level, { ...initialState(level), assignments });
  return level.lockedIndices.every((i) => !isCellLocked(level, state, i));
}

for (const dir of CORPORA) {
  describe(`corpus ${dir.split('/').slice(-2).join('/')}`, () => {
    const manifest = loadManifest(dir);

    it('has coherent manifest bookkeeping', () => {
      expect(manifest.batchSize).toBe(50);
      expect(manifest.dataVersion).toMatch(/^[0-9a-f]{6,}$/);
      const total = manifest.batches.reduce(
        (n, b) => n + (b.levelIds[1] - b.levelIds[0] + 1),
        0,
      );
      expect(total).toBe(manifest.totalLevels);
    });

    it('lists every batch file exactly once and no strays exist', () => {
      const onDisk = readdirSync(dir).filter((f) => f.startsWith('batch-')).sort();
      const listed = manifest.batches.map((b) => b.file).sort();
      expect(onDisk).toEqual(listed);
    });

    it('every manifest hash matches its file bytes', () => {
      for (const b of manifest.batches) {
        const bytes = readFileSync(join(dir, b.file));
        const sha = createHash('sha256').update(bytes).digest('hex');
        expect(sha, b.file).toBe(b.sha256);
        expect(b.file).toContain(sha.slice(0, 6));
      }
    });

    it('every batch has exactly 50 levels except possibly the last', () => {
      manifest.batches.forEach((b, i) => {
        const batch: Batch = JSON.parse(readFileSync(join(dir, b.file), 'utf-8'));
        if (i < manifest.batches.length - 1) {
          expect(batch.levels.length, b.file).toBe(50);
        } else {
          expect(batch.levels.length).toBeGreaterThan(0);
          expect(batch.levels.length).toBeLessThanOrEqual(50);
        }
        expect(batch.levels[0].id).toBe(b.levelIds[0]);
        expect(batch.levels[batch.levels.length - 1].id).toBe(b.levelIds[1]);
      });
    });

    it('levels are internally consistent', () => {
      let expectedId = manifest.batches[0]?.levelIds[0] ?? 1;
      for (const b of manifest.batches) {
        const batch: Batch = JSON.parse(readFileSync(join(dir, b.file), 'utf-8'));
        for (const level of batch.levels) {
          const where = `level ${level.id} in ${b.file}`;
          expect(level.id, where).toBe(expectedId++);
          expect(level.tier, where).toBeGreaterThanOrEqual(1);
          expect(level.tier, where).toBeLessThanOrEqual(5);
          expect(level.cipher.length, where).toBe(level.solution.length);

          // Charset and cipher consistency: a bijection between the
          // letters present and their numbers, -1 exactly on non-letters.
          const byLetter = new Map<string, number>();
          const byNum = new Map<number, string>();
          level.cipher.forEach((num, i) => {
            const ch = level.solution[i];
            expect(ALLOWED.has(ch), `${where}: char ${ch}`).toBe(true);
            if (/[A-Z]/.test(ch)) {
              expect(num, where).toBeGreaterThanOrEqual(1);
              expect(num, where).toBeLessThanOrEqual(26);
              expect(byLetter.get(ch) ?? num, where).toBe(num);
              expect(byNum.get(num) ?? ch, where).toBe(ch);
              byLetter.set(ch, num);
              byNum.set(num, ch);
            } else {
              expect(num, where).toBe(-1);
            }
          });
          expect(byLetter.size, where).toBeGreaterThanOrEqual(12);

          // Revealed pairs must be real (number, letter) pairs of this level.
          for (const [num, letter] of level.revealed) {
            expect(byNum.get(num), where).toBe(letter);
          }

          // Locked indices are letter cells inside multi-letter words.
          const spans = wordSpans(level.solution);
          for (const i of level.lockedIndices) {
            expect(level.cipher[i], where).not.toBe(-1);
            const span = spans.find(([s, e]) => i >= s && i < e);
            expect(span, where).toBeDefined();
            expect(span![1] - span![0], where).toBeGreaterThanOrEqual(2);
          }
          for (const key of Object.keys(level.halfLocked ?? {})) {
            expect(level.lockedIndices, where).toContain(Number(key));
          }

          expect(allLockedReachable(level), `${where}: locked cells reachable`).toBe(
            true,
          );
        }
      }
    });
  });
}
