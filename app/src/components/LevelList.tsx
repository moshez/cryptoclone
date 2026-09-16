import type { LevelState } from '../game';

export const SUBSCRIBE_URL = 'https://moshe-zadka.kit.com/4673940f8b';

/** Tiles per section heading; the horizon is long, so the map reads in hundreds. */
const SECTION = 100;

interface Props {
  totalLevels: number;
  currentLevel: number;
  progress: Record<number, LevelState>;
  onPick: (id: number) => void;
  onClose: () => void;
}

/** The level map: one tile per level, solved ones marked, the current one
 * outlined. It is also where the game talks about itself (subscribe link),
 * so the puzzle screen stays free of anything that is not the puzzle. */
export function LevelList({ totalLevels, currentLevel, progress, onPick, onClose }: Props) {
  const sections: [number, number][] = [];
  for (let start = 1; start <= totalLevels; start += SECTION) {
    sections.push([start, Math.min(start + SECTION - 1, totalLevels)]);
  }
  let solved = 0;
  for (let id = 1; id <= totalLevels; id++) {
    if (progress[id]?.completed) solved++;
  }

  return (
    <section className="levels" data-testid="level-list" aria-label="Level list">
      <div className="levels-head">
        <h2 className="levels-title">Levels</h2>
        <span className="levels-solved" data-testid="levels-solved">
          {solved} / {totalLevels} solved
        </span>
        <button
          type="button"
          className="levels-close"
          data-testid="close-levels"
          onClick={onClose}
        >
          Back to puzzle
        </button>
      </div>

      {sections.map(([start, end]) => (
        <div className="levels-section" key={start}>
          {sections.length > 1 && (
            <h3 className="levels-range">
              {start}–{end}
            </h3>
          )}
          <div className="levels-grid">
            {Array.from({ length: end - start + 1 }, (_, k) => {
              const id = start + k;
              const done = progress[id]?.completed === true;
              const current = id === currentLevel;
              return (
                <button
                  type="button"
                  key={id}
                  className={`level-tile${done ? ' level-tile-solved' : ''}${
                    current ? ' level-tile-current' : ''
                  }`}
                  data-testid={`level-tile-${id}`}
                  aria-label={`Level ${id}${done ? ', solved' : ''}`}
                  aria-current={current ? 'true' : undefined}
                  onClick={() => onPick(id)}
                >
                  {id}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <footer className="levels-footer">
        <a
          className="subscribe-link"
          data-testid="subscribe-link"
          href={SUBSCRIBE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Subscribe to hear about more games or updates to games
        </a>
      </footer>
    </section>
  );
}
