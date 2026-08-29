import type { LevelState } from './game';

interface Stored {
  dataVersion: string;
  currentLevel: number;
  levels: Record<number, LevelState>;
}

const KEY = 'cryptoclone';

function loadRaw(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

/** Progress is keyed by dataVersion: a regenerated corpus starts fresh
 * instead of resurrecting state pointing at different puzzles. */
export function loadProgress(dataVersion: string): Stored {
  const stored = loadRaw();
  if (stored && stored.dataVersion === dataVersion) return stored;
  return { dataVersion, currentLevel: 1, levels: {} };
}

export function saveProgress(stored: Stored): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Storage full or unavailable; play on without persistence.
  }
}
