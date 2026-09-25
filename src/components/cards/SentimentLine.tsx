import { formatCount, sharePercent } from '@/lib/domain/format';
import type { ArtifactTotals } from '@/lib/domain/types';

/**
 * Where people stand, as one line: the positive count on the left, the
 * negative on the right, and a bar between whose split is those two numbers.
 *
 * Deliberately lighter than the reaction box beneath it on a card. It is still
 * the verdict — the badge is computed from these counts — but a line says
 * "which way, and by how much" without a second heavy frame competing with the
 * Medal and Rotten Egg totals.
 *
 * Colour is never the only cue: each end is labelled and carries an arrow.
 */
export function SentimentLine({ totals, size = 'md' }: { totals: ArtifactTotals; size?: 'md' | 'lg' }) {
  const positive = totals.positiveOpinionTotal;
  const negative = totals.negativeOpinionTotal;
  const people = positive + negative;
  const positiveShare = people > 0 ? sharePercent(positive, people) : 0;
  const negativeShare = people > 0 ? 100 - positiveShare : 0;

  const figure = size === 'lg' ? 'text-[22px]' : 'text-[18px]';
  const label = size === 'lg' ? 'text-[11.5px]' : 'text-[10.5px]';

  return (
    <div
      role="group"
      aria-label={
        people === 0
          ? 'No one has taken a side yet.'
          : `${formatCount(positive)} positive, ${formatCount(negative)} negative, out of ${formatCount(people)} ${
              people === 1 ? 'person' : 'people'
            }.`
      }
    >
      <div className="flex items-end justify-between gap-3" aria-hidden="true">
        <Side
          arrow="▲"
          word="positive"
          count={positive}
          share={people > 0 ? positiveShare : null}
          colour="var(--color-positive-deep)"
          figure={figure}
          label={label}
        />
        <Side
          arrow="▼"
          word="negative"
          count={negative}
          share={people > 0 ? negativeShare : null}
          colour="var(--color-negative-deep)"
          figure={figure}
          label={label}
          alignEnd
        />
      </div>

      <div
        className={`mt-1.5 flex overflow-hidden border-2 border-ink bg-[rgb(23_20_15_/_0.1)] ${
          size === 'lg' ? 'h-3.5' : 'h-3'
        }`}
        aria-hidden="true"
      >
        {people > 0 && (
          <>
            <span className="block h-full bg-[color:var(--color-positive)]" style={{ width: `${positiveShare}%` }} />
            <span
              className={`block h-full flex-1 bg-[color:var(--color-negative)] ${
                positiveShare > 0 && negativeShare > 0 ? 'border-l-2 border-ink' : ''
              }`}
            />
          </>
        )}
      </div>

      {people === 0 && (
        <p className={`m-0 mt-1 ${label} font-semibold leading-none text-tertiary`} aria-hidden="true">
          No one has taken a side yet
        </p>
      )}
    </div>
  );
}

function Side({
  arrow,
  word,
  count,
  share,
  colour,
  figure,
  label,
  alignEnd = false,
}: {
  arrow: string;
  word: string;
  count: number;
  share: number | null;
  colour: string;
  figure: string;
  label: string;
  alignEnd?: boolean;
}) {
  return (
    <div className={`flex min-w-0 items-baseline gap-1.5 ${alignEnd ? 'flex-row-reverse text-right' : ''}`}>
      <span className={`numeric-lg ${figure} leading-none`} style={{ color: colour }}>
        {formatCount(count)}
      </span>
      <span className={`truncate ${label} font-bold uppercase leading-none tracking-[0.08em] text-secondary`}>
        <span style={{ color: colour }}>{arrow}</span> {word}
        {share !== null && ` · ${share}%`}
      </span>
    </div>
  );
}
