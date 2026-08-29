import { Fragment } from 'react';
import { isCellLocked, isRevealedCell, type LevelState } from '../game';
import { wordSpans } from '../game';
import type { Level } from '../types';

interface Props {
  level: Level;
  state: LevelState;
  selected: number | null;
  /** A rejected wrong entry, shown briefly in its cell before vanishing. */
  errorFlash: { index: number; letter: string } | null;
  onSelect: (index: number) => void;
}

/** The ciphertext as words of cells; words wrap as units so no word breaks
 * across lines. Punctuation between words is rendered inline. */
export function Grid({ level, state, selected, errorFlash, onSelect }: Props) {
  const spans = wordSpans(level.solution);
  const pieces: JSX.Element[] = [];
  let cursor = 0;
  spans.forEach(([start, end], w) => {
    if (start > cursor) {
      pieces.push(
        <span className="punct" key={`p${cursor}`}>
          {level.solution.slice(cursor, start).trimEnd()}
        </span>,
      );
    }
    pieces.push(
      <span className="word" key={`w${w}`}>
        {Array.from({ length: end - start }, (_, k) => {
          const i = start + k;
          return (
            <Cell
              key={i}
              level={level}
              state={state}
              index={i}
              selected={selected}
              errorFlash={errorFlash}
              onSelect={onSelect}
            />
          );
        })}
      </span>,
    );
    cursor = end;
  });
  if (cursor < level.solution.length) {
    pieces.push(
      <span className="punct" key={`p${cursor}`}>
        {level.solution.slice(cursor).trimEnd()}
      </span>,
    );
  }
  return (
    <div className="grid" data-testid="grid">
      {pieces.map((el) => (
        <Fragment key={el.key}>{el}</Fragment>
      ))}
    </div>
  );
}

function Cell({
  level,
  state,
  index,
  selected,
  errorFlash,
  onSelect,
}: Props & { index: number }) {
  const num = level.cipher[index];
  const locked = isCellLocked(level, state, index);
  const justUnlocked = state.unlocked.includes(index);
  const revealed = isRevealedCell(level, index);
  const flash = !locked && errorFlash?.index === index ? errorFlash.letter : null;
  const guess = locked ? '' : (state.assignments[index] ?? flash ?? '');
  const isSelected = selected === index;
  const sameSymbol = !locked && selected !== null && level.cipher[selected] === num;
  const classes = [
    'cell',
    locked ? 'cell-locked' : '',
    justUnlocked ? 'cell-unlocked' : '',
    revealed ? 'cell-revealed' : '',
    isSelected ? 'cell-selected' : '',
    sameSymbol && !isSelected ? 'cell-same' : '',
    flash !== null ? 'cell-error' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={classes}
      data-testid={`cell-${index}`}
      data-cipher={locked ? '' : num}
      aria-label={locked ? `cell ${index}, locked` : `cell ${index}, symbol ${num}`}
      onClick={() => onSelect(index)}
    >
      <span className="cell-letter">{guess}</span>
      <span className="cell-num">{locked ? '' : num}</span>
    </button>
  );
}
