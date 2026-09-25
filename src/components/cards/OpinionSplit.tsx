import { formatCount, sharePercent } from '@/lib/domain/format';
import type { ArtifactTotals } from '@/lib/domain/types';

/**
 * Where people stand, as the headline figure on a card.
 *
 * Two cells — positive and negative — each with its head count and share, and
 * a bar underneath whose split is the same two numbers. This is the verdict
 * the card's badge is computed from. `ReactionSplit` is built to the same
 * frame directly beneath it, so intensity reads as equal to the head count
 * rather than as its footnote.
 *
 * Colour is never the only cue: each cell is labelled and carries an arrow.
 */
export function OpinionSplit({ totals, size = 'md' }: { totals: ArtifactTotals; size?: 'md' | 'lg' }) {
  const positive = totals.positiveOpinionTotal;
  const negative = totals.negativeOpinionTotal;
  const people = positive + negative;
  const positiveShare = people > 0 ? sharePercent(positive, people) : 0;
  const negativeShare = people > 0 ? 100 - positiveShare : 0;

  const figure = size === 'lg' ? 'text-[clamp(26px,2.6vw,34px)]' : 'text-[24px]';

  return (
    <div
      className="border-2 border-ink"
      role="group"
      aria-label={
        people === 0
          ? 'No one has taken a side yet.'
          : `${formatCount(positive)} positive, ${formatCount(negative)} negative, out of ${formatCount(people)} ${
              people === 1 ? 'person' : 'people'
            }.`
      }
    >
      <div className="grid grid-cols-2" aria-hidden="true">
        <Cell
          label="Positive"
          arrow="▲"
          count={positive}
          share={positiveShare}
          empty={people === 0}
          tint="rgb(34 197 94 / 0.14)"
          colour="var(--color-positive-deep)"
          figure={figure}
          className="border-r-2 border-ink"
        />
        <Cell
          label="Negative"
          arrow="▼"
          count={negative}
          share={negativeShare}
          empty={people === 0}
          tint="rgb(239 68 68 / 0.12)"
          colour="var(--color-negative-deep)"
          figure={figure}
        />
      </div>

      {/* The same split, as a length — green from the left, red the rest. */}
      <div className="flex h-[7px] border-t-2 border-ink bg-[rgb(23_20_15_/_0.12)]" aria-hidden="true">
        {people > 0 && (
          <>
            <span className="block h-full bg-[color:var(--color-positive)]" style={{ width: `${positiveShare}%` }} />
            <span className="block h-full bg-[color:var(--color-negative)]" style={{ width: `${negativeShare}%` }} />
          </>
        )}
      </div>
    </div>
  );
}

function Cell({
  label,
  arrow,
  count,
  share,
  empty,
  tint,
  colour,
  figure,
  className = '',
}: {
  label: string;
  arrow: string;
  count: number;
  share: number;
  empty: boolean;
  tint: string;
  colour: string;
  figure: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 px-3 py-2.5 ${className}`} style={{ backgroundColor: tint }}>
      <div className="flex h-4 items-center gap-1.5 text-[10.5px] font-bold uppercase leading-none tracking-[0.1em]">
        <span style={{ color: colour }}>{arrow}</span>
        {label}
      </div>
      <div className={`numeric-lg mt-1.5 leading-none ${figure}`} style={{ color: colour }}>
        {formatCount(count)}
      </div>
      <div className="mt-1 truncate text-[11px] font-semibold leading-[1.3] text-secondary">
        {count === 1 ? 'person' : 'people'}
        {!empty && ` · ${share}%`}
      </div>
    </div>
  );
}
