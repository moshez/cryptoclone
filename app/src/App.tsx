import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LevelStore, fetchManifest } from './data';
import {
  MAX_ERRORS,
  assign,
  clearCell,
  completedLetters,
  initialState,
  isCellLocked,
  isRevealedCell,
  resetLevel,
  withUnlocks,
  type LevelState,
} from './game';
import { loadProgress, saveProgress } from './storage';
import type { Level, Manifest } from './types';
import { Grid } from './components/Grid';
import { Keyboard } from './components/Keyboard';
import { AttributionCard } from './components/AttributionCard';

declare const __BUILD_ID__: string;

export default function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [store, setStore] = useState<LevelStore | null>(null);
  const [levelId, setLevelId] = useState(1);
  const [level, setLevel] = useState<Level | null>(null);
  const [state, setState] = useState<LevelState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progress = useRef<ReturnType<typeof loadProgress> | null>(null);

  useEffect(() => {
    fetchManifest()
      .then((m) => {
        setManifest(m);
        setStore(new LevelStore(m));
        const p = loadProgress(m.dataVersion);
        progress.current = p;
        setLevelId(p.currentLevel);
      })
      .catch((e: unknown) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!store || !progress.current) return;
    let cancelled = false;
    store
      .getLevel(levelId)
      .then((lv) => {
        if (cancelled) return;
        const saved = progress.current!.levels[lv.id];
        const st = saved ? withUnlocks(lv, saved) : withUnlocks(lv, initialState(lv));
        setLevel(lv);
        setState(st);
        setSelected(firstOpenCell(lv, st));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [store, levelId]);

  const persist = useCallback((id: number, next: LevelState) => {
    if (!progress.current) return;
    progress.current.levels[id] = next;
    progress.current.currentLevel = id;
    saveProgress(progress.current);
  }, []);

  const applyState = useCallback(
    (next: LevelState) => {
      if (!level) return;
      setState(next);
      persist(level.id, next);
    },
    [level, persist],
  );

  const onLetter = useCallback(
    (letter: string) => {
      if (!level || !state || selected === null || state.completed) return;
      const num = level.cipher[selected];
      if (num === -1 || isCellLocked(level, state, selected)) return;
      if (isRevealedCell(level, selected)) return;
      const result = assign(level, state, selected, letter);
      applyState(result.state);
      if (result.wasError) {
        setShake(true);
        setTimeout(() => setShake(false), 400);
      }
      if (!result.didReset && !result.wasError) {
        setSelected(nextOpenCell(level, result.state, selected));
      }
    },
    [level, state, selected, applyState],
  );

  const onClear = useCallback(() => {
    if (!level || !state || selected === null) return;
    if (level.cipher[selected] === -1) return;
    applyState(clearCell(level, state, selected));
  }, [level, state, selected, applyState]);

  const onReset = useCallback(() => {
    if (!level) return;
    const fresh = resetLevel(level);
    applyState(fresh);
    setSelected(firstOpenCell(level, fresh));
  }, [level, applyState]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) onLetter(e.key.toUpperCase());
      else if (e.key === 'Backspace' || e.key === 'Delete') onClear();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onLetter, onClear]);

  const gotoLevel = useCallback(
    (id: number) => {
      if (!manifest) return;
      const clamped = Math.min(Math.max(id, 1), manifest.totalLevels);
      setLevelId(clamped);
      if (progress.current) {
        progress.current.currentLevel = clamped;
        saveProgress(progress.current);
      }
    },
    [manifest],
  );

  const doneLetters = useMemo(
    () => (level && state ? completedLetters(level, state) : new Set<string>()),
    [level, state],
  );

  if (error) {
    return (
      <div className="app">
        <p className="load-error">Could not load puzzle data: {error}</p>
      </div>
    );
  }
  if (!manifest || !level || !state) {
    return (
      <div className="app">
        <p className="loading">Loading…</p>
      </div>
    );
  }

  const lockedForKeyboard =
    selected !== null &&
    (level.cipher[selected] === -1 ||
      isCellLocked(level, state, selected) ||
      isRevealedCell(level, selected));

  return (
    <div className={`app${shake ? ' shake' : ''}`}>
      <header className="topbar">
        <h1 className="title">Vision &amp; Cipher</h1>
        <nav className="level-nav">
          <button
            aria-label="Previous level"
            data-testid="prev-level"
            disabled={levelId <= 1}
            onClick={() => gotoLevel(levelId - 1)}
          >
            ‹
          </button>
          <label className="level-picker">
            Level{' '}
            <input
              type="number"
              data-testid="level-input"
              min={1}
              max={manifest.totalLevels}
              value={levelId}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isInteger(v)) gotoLevel(v);
              }}
            />{' '}
            / {manifest.totalLevels}
          </label>
          <button
            aria-label="Next level"
            data-testid="next-level"
            disabled={levelId >= manifest.totalLevels}
            onClick={() => gotoLevel(levelId + 1)}
          >
            ›
          </button>
        </nav>
        <div className="status">
          <span className="tier" data-testid="tier">
            Tier {level.tier}
          </span>
          <span className="errors" data-testid="errors" aria-label="errors">
            {Array.from({ length: MAX_ERRORS }, (_, i) => (
              <span key={i} className={`pip${i < state.errors ? ' pip-hit' : ''}`} />
            ))}
          </span>
        </div>
      </header>

      <main className="board">
        <Grid
          level={level}
          state={state}
          selected={selected}
          onSelect={(i) => {
            if (level.cipher[i] !== -1 && !isCellLocked(level, state, i)) setSelected(i);
          }}
        />
        {state.completed && (
          <AttributionCard
            attribution={level.attribution}
            solution={level.solution}
            onNext={levelId < manifest.totalLevels ? () => gotoLevel(levelId + 1) : undefined}
          />
        )}
      </main>

      {!state.completed && (
        <Keyboard
          doneLetters={doneLetters}
          disabled={selected === null || lockedForKeyboard}
          onLetter={onLetter}
          onClear={onClear}
          onReset={onReset}
          clearDisabled={
            selected === null ||
            level.cipher[selected] === -1 ||
            isRevealedCell(level, selected)
          }
        />
      )}

      <footer className="about">
        <span data-testid="build-id" title="build">
          build {__BUILD_ID__}
        </span>
        <span data-testid="data-version"> · data {manifest.dataVersion}</span>
      </footer>
    </div>
  );
}

function firstOpenCell(level: Level, state: LevelState): number | null {
  let fallback: number | null = null;
  for (let i = 0; i < level.cipher.length; i++) {
    if (level.cipher[i] === -1 || isCellLocked(level, state, i)) continue;
    if (fallback === null) fallback = i;
    if (state.assignments[i] === undefined) return i;
  }
  return fallback;
}

function nextOpenCell(level: Level, state: LevelState, from: number): number | null {
  const n = level.cipher.length;
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n;
    if (level.cipher[i] === -1 || isCellLocked(level, state, i)) continue;
    if (state.assignments[i] === undefined) return i;
  }
  return from;
}
