const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

interface Props {
  /** Letters the player is finished with (every cell needing them filled). */
  doneLetters: Set<string>;
  disabled: boolean;
  onLetter: (letter: string) => void;
  onReset: () => void;
}

export function Keyboard({ doneLetters, disabled, onLetter, onReset }: Props) {
  return (
    <div className="keyboard" data-testid="keyboard">
      {ROWS.map((row, r) => (
        <div className="key-row" key={r}>
          {row.split('').map((letter) => {
            const done = doneLetters.has(letter);
            return (
              <button
                type="button"
                key={letter}
                className={`key${done ? ' key-used' : ''}`}
                data-testid={`key-${letter}`}
                disabled={disabled}
                onClick={() => onLetter(letter)}
              >
                {letter}
              </button>
            );
          })}
          {r === 2 && (
            <button
              type="button"
              className="key key-wide"
              data-testid="key-reset"
              onClick={onReset}
            >
              ↺
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
