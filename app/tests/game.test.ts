import { describe, expect, it } from 'vitest';
import {
  MAX_ERRORS,
  assign,
  clearSymbol,
  correctLetter,
  initialState,
  isCellLocked,
  isComplete,
  resetLevel,
  withUnlocks,
  wordSpans,
} from '../src/game';
import type { Level } from '../src/types';

// "AB BA" with A=1, B=2; A revealed.
function makeLevel(overrides: Partial<Level> = {}): Level {
  return {
    id: 1,
    tier: 1,
    solution: 'AB BA',
    cipher: [1, 2, -1, 2, 1],
    revealed: [[1, 'A']],
    lockedIndices: [],
    attribution: { author: 'x', work: 'y', year: 1920, essay: 'z' },
    ...overrides,
  };
}

describe('assignment', () => {
  it('prefills revealed mappings', () => {
    const level = makeLevel();
    expect(initialState(level).assignments).toEqual({ 1: 'A' });
  });

  it('propagates by symbol: one assignment covers every cell of the symbol', () => {
    const level = makeLevel();
    const { state } = assign(level, initialState(level), 2, 'B');
    // Both cells with cipher 2 (indices 1 and 3) read from the same entry.
    expect(state.assignments[2]).toBe('B');
    expect(state.completed).toBe(true);
  });

  it('wrong assignment sticks but counts an error', () => {
    const level = makeLevel();
    const r = assign(level, initialState(level), 2, 'Z');
    expect(r.wasError).toBe(true);
    expect(r.state.errors).toBe(1);
    expect(r.state.assignments[2]).toBe('Z');
    expect(r.state.completed).toBe(false);
  });

  it('third error resets the puzzle', () => {
    const level = makeLevel();
    let state = initialState(level);
    for (const letter of ['X', 'Y']) {
      state = assign(level, state, 2, letter).state;
    }
    expect(state.errors).toBe(2);
    const r = assign(level, state, 2, 'W');
    expect(r.didReset).toBe(true);
    expect(r.state.errors).toBe(0);
    expect(r.state.assignments).toEqual({ 1: 'A' }); // back to revealed only
    expect(MAX_ERRORS).toBe(3);
  });

  it('clear removes a guess but never a revealed mapping', () => {
    const level = makeLevel();
    let state = assign(level, initialState(level), 2, 'Z').state;
    state = clearSymbol(level, state, 2);
    expect(state.assignments[2]).toBeUndefined();
    state = clearSymbol(level, state, 1);
    expect(state.assignments[1]).toBe('A');
  });

  it('reset returns to the initial presentation', () => {
    const level = makeLevel();
    const dirty = assign(level, initialState(level), 2, 'Z').state;
    expect(resetLevel(level)).toEqual(withUnlocks(level, initialState(level)));
    expect(dirty).not.toEqual(resetLevel(level));
  });

  it('completion requires every symbol correct', () => {
    const level = makeLevel();
    expect(isComplete(level, { 1: 'A' })).toBe(false);
    expect(isComplete(level, { 1: 'A', 2: 'B' })).toBe(true);
    expect(isComplete(level, { 1: 'A', 2: 'X' })).toBe(false);
  });

  it('correctLetter reads the solution through the cipher', () => {
    const level = makeLevel();
    expect(correctLetter(level, 1)).toBe('A');
    expect(correctLetter(level, 2)).toBe('B');
  });
});

describe('locked cells', () => {
  // "CAB": C=3 locked at index 0; A=1 revealed at index 1.
  const locked = makeLevel({
    solution: 'CAB',
    cipher: [3, 1, 2],
    revealed: [[1, 'A']],
    lockedIndices: [0],
  });

  it('a locked cell is locked until a correct neighbour, then stays open', () => {
    const s0 = withUnlocks(locked, initialState(locked));
    // Neighbour (index 1) is revealed-correct already, so the lock opens
    // immediately from the start state.
    expect(isCellLocked(locked, s0, 0)).toBe(false);
  });

  it('unlock happens only when the neighbour is correctly filled', () => {
    const harder = makeLevel({
      solution: 'CAB',
      cipher: [3, 1, 2],
      revealed: [],
      lockedIndices: [0],
    });
    let state = withUnlocks(harder, initialState(harder));
    expect(isCellLocked(harder, state, 0)).toBe(true);
    state = assign(harder, state, 1, 'X').state; // wrong neighbour fill
    expect(isCellLocked(harder, state, 0)).toBe(true);
    state = clearSymbol(harder, state, 1);
    state = assign(harder, state, 1, 'A').state; // correct
    expect(isCellLocked(harder, state, 0)).toBe(false);
  });

  it('unlocks cascade along a word', () => {
    // "DCAB": D and C locked; filling A unlocks C, which (once correct by
    // propagation? no - C must be *filled* correctly to open D) ...
    const cascade = makeLevel({
      solution: 'DCAB',
      cipher: [4, 3, 1, 2],
      revealed: [],
      lockedIndices: [0, 1],
    });
    let state = withUnlocks(cascade, initialState(cascade));
    state = assign(cascade, state, 1, 'A').state;
    expect(isCellLocked(cascade, state, 1)).toBe(false); // C's number visible
    expect(isCellLocked(cascade, state, 0)).toBe(true); // D still hidden
    state = assign(cascade, state, 3, 'C').state;
    expect(isCellLocked(cascade, state, 0)).toBe(false);
  });

  it('half-locked cells only open from their allowed side', () => {
    // "BAC" with the middle cell locked from the right only: filling B
    // (left neighbour) must NOT open it; filling C (right neighbour) must.
    const half = makeLevel({
      solution: 'BAC',
      cipher: [2, 1, 3],
      revealed: [],
      lockedIndices: [1],
      halfLocked: { '1': 'right' },
    });
    let state = withUnlocks(half, initialState(half));
    state = assign(half, state, 2, 'B').state;
    expect(isCellLocked(half, state, 1)).toBe(true);
    state = assign(half, state, 3, 'C').state;
    expect(isCellLocked(half, state, 1)).toBe(false);
  });

  it('adjacency does not cross word boundaries', () => {
    // "AB CA": index 3 (C) locked; index 1 (B, other word) adjacent only
    // through the space, so filling B must not unlock C.
    const words = makeLevel({
      solution: 'AB CA',
      cipher: [1, 2, -1, 3, 1],
      revealed: [],
      lockedIndices: [3],
    });
    let state = withUnlocks(words, initialState(words));
    state = assign(words, state, 2, 'B').state;
    expect(isCellLocked(words, state, 3)).toBe(true);
    state = assign(words, state, 1, 'A').state; // index 4, same word
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
