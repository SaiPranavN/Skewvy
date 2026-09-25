import { formatCount, sharePercent } from '@/lib/domain/format';
import type { ArtifactTotals } from '@/lib/domain/types';

/**
 * How hard people reacted, built to the same frame as `OpinionSplit`.
 *
 * The two boxes answer different questions — how many people are on each
 * side, and how intensely they reacted — and neither is a footnote to the
 * other, so they get the same frame, the same type sizes and the same bar.
 * Medals sit under Positive and Rotten Eggs under Negative, so each column
 * reads down as one side of the argument.
 *
 * Every tap total carries the number of people behind it, so a big count from
 * one person can never pass for a crowd.
 */
export function ReactionSplit({ totals, size = 'md' }: { totals: ArtifactTotals; size?: 'md' | 'lg' }) {
  const medals = totals.medalTotal;
  const eggs = totals.rottenEggTotal;
  const taps = medals + eggs;
  const medalShare = taps > 0 ? sharePercent(medals, taps) : 0;
  const eggShare = taps > 0 ? 100 - medalShare : 0;

  const figure = size === 'lg' ? 'text-[clamp(26px,2.6vw,34px)]' : 'text-[24px]';

  return (
    <div
      className="border-2 border-ink"
      role="group"
      aria-label={
        taps === 0
          ? 'No reactions yet.'
          : `${formatCount(medals)} Medals from ${people(totals.medalContributorTotal)}, ${formatCount(
              eggs,
            )} Rotten Eggs from ${people(totals.rottenEggContributorTotal)}.`
      }
    >
      <div className="grid grid-cols-2" aria-hidden="true">
        <Cell
          label="Medals"
          glyph="🏅"
          kind="medal"
          count={medals}
          contributors={totals.medalContributorTotal}
          tint="rgb(255 200 40 / 0.2)"
          colour="var(--color-medal-deep)"
          figure={figure}
          className="border-r-2 border-ink"
        />
        <Cell
          label="Rotten Eggs"
          glyph="🥚"
          kind="egg"
          count={eggs}
          contributors={totals.rottenEggContributorTotal}
          tint="rgb(255 107 69 / 0.16)"
          colour="var(--color-egg-deep)"
          figure={figure}
        />
      </div>

      {/* Share of all taps, Medals from the left and Rotten Eggs the rest. */}
      <div className="flex h-[7px] border-t-2 border-ink bg-[rgb(23_20_15_/_0.12)]" aria-hidden="true">
        {taps > 0 && (
          <>
            <span className="block h-full bg-[color:var(--color-medal)]" style={{ width: `${medalShare}%` }} />
            <span className="block h-full bg-[color:var(--color-egg)]" style={{ width: `${eggShare}%` }} />
          </>
        )}
      </div>
    </div>
  );
}

function people(count: number): string {
  return `${formatCount(count)} ${count === 1 ? 'person' : 'people'}`;
}

function Cell({
  label,
  glyph,
  kind,
  count,
  contributors,
  tint,
  colour,
  figure,
  className = '',
}: {
  label: string;
  glyph: string;
  kind: 'egg' | 'medal';
  count: number;
  contributors: number;
  tint: string;
  colour: string;
  figure: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 px-3 py-2.5 ${className}`} style={{ backgroundColor: tint }}>
      <div className="flex h-4 items-center gap-1.5 truncate text-[10.5px] font-bold uppercase leading-none tracking-[0.1em]">
        <span className={`emoji emoji-${kind} text-[13px]`}>{glyph}</span>
        {label}
      </div>
      <div className={`numeric-lg mt-1.5 leading-none ${figure}`} style={{ color: colour }}>
        {formatCount(count)}
      </div>
      <div className="mt-1 truncate text-[11px] font-semibold leading-[1.3] text-secondary">
        {contributors === 0 ? 'nobody yet' : `from ${people(contributors)}`}
      </div>
    </div>
  );
}
