import { describe, expect, it } from 'vitest';
import {
  MAX_ERRORS,
  assign,
  completedLetters,
  initialState,
  isCellLocked,
  isComplete,
  resetLevel,
  withUnlocks,
  wordSpans,
} from '../src/game';
import type { Level } from '../src/types';

// "AB BA" with A=1, B=2; the A at index 0 revealed.
function makeLevel(overrides: Partial<Level> = {}): Level {
  return {
    id: 1,
    tier: 1,
    solution: 'AB BA',
    cipher: [1, 2, -1, 2, 1],
    revealedIndices: [0],
    lockedIndices: [],
    attribution: { author: 'x', work: 'y', year: 1920, essay: 'z' },
    ...overrides,
  };
}

describe('assignment', () => {
  it('prefills revealed cells only, not the rest of their symbol', () => {
    const level = makeLevel();
    // Index 0 (A) is given; index 4 is also A but starts empty.
    expect(initialState(level).assignments).toEqual({ 0: 'A' });
  });

  it('fills exactly the chosen cell: knowing a mapping never auto-fills', () => {
    const level = makeLevel();
    const { state } = assign(level, initialState(level), 1, 'B');
    // Index 3 has the same cipher number but stays empty.
    expect(state.assignments[1]).toBe('B');
    expect(state.assignments[3]).toBeUndefined();
    expect(state.completed).toBe(false);
  });

  it('completes once every cell is filled by hand', () => {
    const level = makeLevel();
    let state = initialState(level);
    state = assign(level, state, 1, 'B').state;
    state = assign(level, state, 3, 'B').state;
    expect(state.completed).toBe(false);
    state = assign(level, state, 4, 'A').state;
    expect(state.completed).toBe(true);
  });

  it('wrong entry counts an error but is undone: it never sticks', () => {
    const level = makeLevel();
    const r = assign(level, initialState(level), 1, 'Z');
    expect(r.wasError).toBe(true);
    expect(r.state.errors).toBe(1);
    expect(r.state.assignments[1]).toBeUndefined();
    expect(r.state.completed).toBe(false);
  });

  it('third error resets the puzzle', () => {
    const level = makeLevel();
    let state = initialState(level);
    for (const letter of ['X', 'Y']) {
      state = assign(level, state, 1, letter).state;
    }
    expect(state.errors).toBe(2);
    expect(state.assignments[1]).toBeUndefined();
    const r = assign(level, state, 3, 'W');
    expect(r.didReset).toBe(true);
    expect(r.state.errors).toBe(0);
    expect(r.state.assignments).toEqual({ 0: 'A' }); // back to revealed only
    expect(MAX_ERRORS).toBe(3);
  });

  it('revealed cells reject entry', () => {
    const level = makeLevel();
    const state = initialState(level);
    const r = assign(level, state, 0, 'Z');
    expect(r.state).toBe(state);
    expect(r.wasError).toBe(false);
  });

  it('a filled cell is final: further entry is rejected without an error', () => {
    const level = makeLevel();
    const { state } = assign(level, initialState(level), 1, 'B');
    const r = assign(level, state, 1, 'Z');
    expect(r.state).toBe(state);
    expect(r.wasError).toBe(false);
    expect(r.state.assignments[1]).toBe('B');
  });

  it('reset returns to the initial presentation', () => {
    const level = makeLevel();
    const dirty = assign(level, initialState(level), 1, 'Z').state;
    expect(resetLevel(level)).toEqual(withUnlocks(level, initialState(level)));
    expect(dirty).not.toEqual(resetLevel(level));
  });

  it('completion requires every cell correct', () => {
    const level = makeLevel();
    expect(isComplete(level, { 0: 'A', 1: 'B', 3: 'B' })).toBe(false);
    expect(isComplete(level, { 0: 'A', 1: 'B', 3: 'B', 4: 'A' })).toBe(true);
    expect(isComplete(level, { 0: 'A', 1: 'B', 3: 'X', 4: 'A' })).toBe(false);
  });

  it('completedLetters tracks letters with every cell filled', () => {
    const level = makeLevel();
    let state = initialState(level);
    // A appears at 0 (given) and 4 (empty): not done yet.
    expect(completedLetters(level, state)).toEqual(new Set());
    state = assign(level, state, 4, 'A').state;
    expect(completedLetters(level, state)).toEqual(new Set(['A']));
    state = assign(level, state, 1, 'B').state;
    expect(completedLetters(level, state)).toEqual(new Set(['A']));
    state = assign(level, state, 3, 'B').state;
    expect(completedLetters(level, state)).toEqual(new Set(['A', 'B']));
  });
});

describe('locked cells', () => {
  it('a locked cell opens immediately when its neighbour is a revealed cell', () => {
    // "CAB": C locked at index 0; the A at index 1 is a given.
    const locked = makeLevel({
      solution: 'CAB',
      cipher: [3, 1, 2],
      revealedIndices: [1],
      lockedIndices: [0],
    });
    const s0 = withUnlocks(locked, initialState(locked));
    expect(isCellLocked(locked, s0, 0)).toBe(false);
  });

  it('unlock happens only when the neighbour cell is correctly filled', () => {
    const harder = makeLevel({
      solution: 'CAB',
      cipher: [3, 1, 2],
      revealedIndices: [],
      lockedIndices: [0],
    });
    let state = withUnlocks(harder, initialState(harder));
    expect(isCellLocked(harder, state, 0)).toBe(true);
    state = assign(harder, state, 1, 'X').state; // wrong fill: undone, no unlock
    expect(isCellLocked(harder, state, 0)).toBe(true);
    state = assign(harder, state, 1, 'A').state; // correct
    expect(isCellLocked(harder, state, 0)).toBe(false);
  });

  it('filling one cell of a symbol does not unlock next to its other cells', () => {
    // "ABA C": index 2 (A) neighbours nothing locked, but index 0 (A) does
    // not become "correct" just because index 2 was filled.
    const level = makeLevel({
      solution: 'ABAC',
      cipher: [1, 2, 1, 3],
      revealedIndices: [],
      lockedIndices: [1],
    });
    let state = withUnlocks(level, initialState(level));
    state = assign(level, state, 2, 'A').state; // fills only index 2
    expect(isCellLocked(level, state, 1)).toBe(false); // index 2 is adjacent
    const level2 = makeLevel({
      solution: 'ABCA',
      cipher: [1, 2, 3, 1],
      revealedIndices: [],
      lockedIndices: [1],
    });
    let state2 = withUnlocks(level2, initialState(level2));
    state2 = assign(level2, state2, 3, 'A').state; // far A: not adjacent
    expect(isCellLocked(level2, state2, 1)).toBe(true);
  });

  it('unlocks cascade along a word', () => {
    const cascade = makeLevel({
      solution: 'DCAB',
      cipher: [4, 3, 1, 2],
      revealedIndices: [],
      lockedIndices: [0, 1],
    });
    let state = withUnlocks(cascade, initialState(cascade));
    state = assign(cascade, state, 2, 'A').state;
    expect(isCellLocked(cascade, state, 1)).toBe(false); // C's number visible
    expect(isCellLocked(cascade, state, 0)).toBe(true); // D still hidden
    state = assign(cascade, state, 1, 'C').state;
    expect(isCellLocked(cascade, state, 0)).toBe(false);
  });

  it('half-locked cells only open from their allowed side', () => {
    const half = makeLevel({
      solution: 'BAC',
      cipher: [2, 1, 3],
      revealedIndices: [],
      lockedIndices: [1],
      halfLocked: { '1': 'right' },
    });
    let state = withUnlocks(half, initialState(half));
    state = assign(half, state, 0, 'B').state;
    expect(isCellLocked(half, state, 1)).toBe(true);
    state = assign(half, state, 2, 'C').state;
    expect(isCellLocked(half, state, 1)).toBe(false);
  });

  it('adjacency does not cross word boundaries', () => {
    // "AB CA": index 3 (C) locked; index 1 (B, other word) adjacent only
    // through the space, so filling B must not unlock C.
    const words = makeLevel({
      solution: 'AB CA',
      cipher: [1, 2, -1, 3, 1],
      revealedIndices: [],
      lockedIndices: [3],
    });
    let state = withUnlocks(words, initialState(words));
    state = assign(words, state, 1, 'B').state;
    expect(isCellLocked(words, state, 3)).toBe(true);
    state = assign(words, state, 4, 'A').state; // index 4, same word
    expect(isCellLocked(words, state, 3)).toBe(false);
  });
});

describe('wordSpans', () => {
  it('finds alphabetic runs', () => {
    expect(wordSpans('AB, CD')).toEqual([
      [0, 2],
      [4, 6],
    ]);
    expect(wordSpans("DON'T GO")).toEqual([
      [0, 3],
      [4, 5],
      [6, 8],
    ]);
  });
});
