const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

interface Props {
  /** Letters the player is finished with (every cell needing them filled). */
  doneLetters: Set<string>;
  disabled: boolean;
  clearDisabled: boolean;
  onLetter: (letter: string) => void;
  onClear: () => void;
  onReset: () => void;
}

export function Keyboard({
  doneLetters,
  disabled,
  clearDisabled,
  onLetter,
  onClear,
  onReset,
}: Props) {
  return (
    <div className="keyboard" data-testid="keyboard">
      {ROWS.map((row, r) => (
        <div className="key-row" key={r}>
          {r === 2 && (
            <button
              type="button"
              className="key key-wide"
              data-testid="key-clear"
              disabled={clearDisabled}
              onClick={onClear}
            >
              ⌫
            </button>
          )}
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
