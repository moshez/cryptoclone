import type { Level } from './types';

export interface LevelState {
  /** cell index -> letter entered in that cell. Entries apply to one cell
   * only: figuring out a mapping never auto-fills the other cells of that
   * cipher number — the player types each one. */
  assignments: Record<number, string>;
  errors: number;
  /** locked cell indices whose numbers have been revealed (permanent until reset) */
  unlocked: number[];
  completed: boolean;
}

export const MAX_ERRORS = 3;

export function initialState(level: Level): LevelState {
  const assignments: Record<number, string> = {};
  for (const i of level.revealedIndices) assignments[i] = level.solution[i];
  return { assignments, errors: 0, unlocked: [], completed: false };
}

export function isRevealedCell(level: Level, index: number): boolean {
  return level.revealedIndices.includes(index);
}

export function isComplete(level: Level, assignments: Record<number, string>): boolean {
  return level.cipher.every((num, i) => num === -1 || assignments[i] === level.solution[i]);
}

export interface AssignResult {
  state: LevelState;
  wasError: boolean;
  didReset: boolean;
}

/** Enter `letter` into the cell at `index`. A wrong letter still sticks, but
 * counts an error; the third error resets the whole puzzle. */
export function assign(
  level: Level,
  state: LevelState,
  index: number,
  letter: string,
): AssignResult {
  if (state.completed || isRevealedCell(level, index)) {
    return { state, wasError: false, didReset: false };
  }
  if (state.assignments[index] === letter) return { state, wasError: false, didReset: false };
  const wasError = level.solution[index] !== letter;
  const errors = state.errors + (wasError ? 1 : 0);
  if (errors >= MAX_ERRORS) {
    return { state: resetLevel(level), wasError: true, didReset: true };
  }
  const assignments = { ...state.assignments, [index]: letter };
  const next: LevelState = {
    assignments,
    errors,
    unlocked: state.unlocked,
    completed: isComplete(level, assignments),
  };
  return { state: withUnlocks(level, next), wasError, didReset: false };
}

export function clearCell(level: Level, state: LevelState, index: number): LevelState {
  if (state.completed || isRevealedCell(level, index)) return state;
  if (state.assignments[index] === undefined) return state;
  const assignments = { ...state.assignments };
  delete assignments[index];
  return { ...state, assignments };
}

export function resetLevel(level: Level): LevelState {
  return withUnlocks(level, initialState(level));
}

export function wordSpans(solution: string): [number, number][] {
  const spans: [number, number][] = [];
  let start = -1;
  for (let i = 0; i < solution.length; i++) {
    if (/[A-Za-z]/.test(solution[i])) {
      if (start === -1) start = i;
    } else if (start !== -1) {
      spans.push([start, i]);
      start = -1;
    }
  }
  if (start !== -1) spans.push([start, solution.length]);
  return spans;
}

function wordIndexMap(solution: string): Map<number, number> {
  const map = new Map<number, number>();
  wordSpans(solution).forEach(([s, e], w) => {
    for (let i = s; i < e; i++) map.set(i, w);
  });
  return map;
}

function cellCorrect(
  level: Level,
  assignments: Record<number, string>,
  lockedNow: Set<number>,
  i: number,
): boolean {
  const num = level.cipher[i];
  if (num === -1 || lockedNow.has(i)) return false;
  return assignments[i] === level.solution[i];
}

/** Recompute which locked cells are revealed: starting from currently visible
 * correctly-filled cells, repeatedly unlock locked cells adjacent (in the
 * allowed direction) to one. Unlocks accumulate; they never re-lock while
 * the level is in play. */
export function withUnlocks(level: Level, state: LevelState): LevelState {
  if (level.lockedIndices.length === 0) return state;
  const words = wordIndexMap(level.solution);
  const unlocked = new Set(state.unlocked);
  let changed = true;
  while (changed) {
    changed = false;
    const lockedNow = new Set(level.lockedIndices.filter((i) => !unlocked.has(i)));
    for (const i of lockedNow) {
      const dir = level.halfLocked?.[String(i)] ?? 'both';
      const fromLeft =
        (dir === 'both' || dir === 'left') &&
        words.get(i - 1) === words.get(i) &&
        cellCorrect(level, state.assignments, lockedNow, i - 1);
      const fromRight =
        (dir === 'both' || dir === 'right') &&
        words.get(i + 1) === words.get(i) &&
        cellCorrect(level, state.assignments, lockedNow, i + 1);
      if (fromLeft || fromRight) {
        unlocked.add(i);
        changed = true;
      }
    }
  }
  if (unlocked.size === state.unlocked.length) return state;
  return { ...state, unlocked: [...unlocked].sort((a, b) => a - b) };
}

export function isCellLocked(level: Level, state: LevelState, i: number): boolean {
  return level.lockedIndices.includes(i) && !state.unlocked.includes(i);
}

/** Letters the player is finished with: every cell needing the letter holds
 * it. Drives the keyboard's "done" styling. */
export function completedLetters(level: Level, state: LevelState): Set<string> {
  const remaining = new Set<string>();
  const present = new Set<string>();
  level.cipher.forEach((num, i) => {
    if (num === -1) return;
    present.add(level.solution[i]);
    if (state.assignments[i] !== level.solution[i]) remaining.add(level.solution[i]);
  });
  return new Set([...present].filter((ch) => !remaining.has(ch)));
}
