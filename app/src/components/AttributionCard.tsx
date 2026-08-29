import type { Attribution } from '../types';

interface Props {
  attribution: Attribution;
  solution: string;
  onNext?: () => void;
}

/** Post-solve card: the sentence and where it comes from. The source is
 * part of the appeal, not a legal footnote. */
export function AttributionCard({ attribution, solution, onNext }: Props) {
  return (
    <div className="attribution" data-testid="attribution" role="status">
      <p className="attribution-quote">“{sentenceCase(solution)}”</p>
      <p className="attribution-source">
        <span data-testid="attribution-author">{attribution.author}</span>,{' '}
        <cite data-testid="attribution-work">{attribution.work}</cite> ({attribution.year}),
        from the essay <span data-testid="attribution-essay">“{attribution.essay}”</span> — a
        collection of art criticism that helped establish formalism in modern aesthetics.
      </p>
      {onNext && (
        <button
          type="button"
          className="next-button"
          data-testid="next-after-solve"
          onClick={onNext}
        >
          Next puzzle →
        </button>
      )}
    </div>
  );
}

function sentenceCase(upper: string): string {
  const lower = upper.toLowerCase();
  let out = '';
  let capitalize = true;
  for (const ch of lower) {
    out += capitalize && /[a-z]/.test(ch) ? ch.toUpperCase() : ch;
    if (/[a-z]/.test(ch)) capitalize = false;
    if ('.!?'.includes(ch)) capitalize = true;
  }
  // The corpus is uppercased; "i" as a word is really "I".
  return out.replace(/\bi\b/g, 'I');
}
