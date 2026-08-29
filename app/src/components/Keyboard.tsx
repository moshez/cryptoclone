const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

interface Props {
  usedLetters: Set<string>;
  revealedLetters: Set<string>;
  disabled: boolean;
  clearDisabled: boolean;
  onLetter: (letter: string) => void;
  onClear: () => void;
  onReset: () => void;
}

export function Keyboard({
  usedLetters,
  revealedLetters,
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
            const used = usedLetters.has(letter);
            const revealed = revealedLetters.has(letter);
            return (
              <button
                type="button"
                key={letter}
                className={`key${used ? ' key-used' : ''}${revealed ? ' key-revealed' : ''}`}
                data-testid={`key-${letter}`}
                disabled={disabled || revealed}
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
