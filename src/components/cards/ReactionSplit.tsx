import { formatCount, sharePercent } from '@/lib/domain/format';
import type { ArtifactTotals } from '@/lib/domain/types';

/**
 * How hard people reacted: the Medal and Rotten Egg totals, big, side by
 * side, with the share of all taps as a bar underneath. On a card it is the
 * main figure; the people split sits above it as a lighter `SentimentLine`.
 * Medals are on the left under Positive and Rotten Eggs on the right under
 * Negative, so each side of the card reads down as one half of the argument.
 *
 * Every tap total carries the number of people behind it, so a big count from
 * one person can never pass for a crowd.
 *
 * Open type on the card rather than boxed cells: the card is already the box,
 * and the Rotten Egg figure sits flush right, under Negative.
 */
export function ReactionSplit({ totals, size = 'md' }: { totals: ArtifactTotals; size?: 'md' | 'lg' }) {
  const medals = totals.medalTotal;
  const eggs = totals.rottenEggTotal;
  const taps = medals + eggs;
  const medalShare = taps > 0 ? sharePercent(medals, taps) : 0;
  const eggShare = taps > 0 ? 100 - medalShare : 0;

  // The headline numbers of a card: as large as the cell allows.
  const figure = size === 'lg' ? 'text-[clamp(34px,3.4vw,46px)]' : 'text-[34px]';

  return (
    <div
      role="group"
      aria-label={
        taps === 0
          ? 'No reactions yet.'
          : `${formatCount(medals)} Medals from ${people(totals.medalContributorTotal)}, ${formatCount(
              eggs,
            )} Rotten Eggs from ${people(totals.rottenEggContributorTotal)}.`
      }
    >
      <div className="grid grid-cols-2 gap-4" aria-hidden="true">
        <Cell
          label="Medals"
          glyph="🏅"
          kind="medal"
          count={medals}
          contributors={totals.medalContributorTotal}
          colour="var(--color-medal-deep)"
          figure={figure}
        />
        <Cell
          label="Rotten Eggs"
          glyph="🥚"
          kind="egg"
          count={eggs}
          contributors={totals.rottenEggContributorTotal}
          colour="var(--color-egg-deep)"
          figure={figure}
          alignEnd
        />
      </div>

      {/* Share of all taps, Medals from the left and Rotten Eggs the rest. */}
      <div className="mt-3 flex h-[4px] bg-[rgb(23_20_15_/_0.1)]" aria-hidden="true">
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
  colour,
  figure,
  alignEnd = false,
}: {
  label: string;
  glyph: string;
  kind: 'egg' | 'medal';
  count: number;
  contributors: number;
  colour: string;
  figure: string;
  alignEnd?: boolean;
}) {
  return (
    <div className={`min-w-0 ${alignEnd ? 'text-right' : ''}`}>
      <div
        className={`flex h-5 items-center gap-1.5 truncate text-[11px] font-bold uppercase leading-none tracking-[0.1em] ${
          alignEnd ? 'justify-end' : ''
        }`}
      >
        <span className={`emoji emoji-${kind} text-[18px]`}>{glyph}</span>
        {label}
      </div>
      <div className={`numeric-lg mt-2 truncate leading-none ${figure}`} style={{ color: colour }}>
        {formatCount(count)}
      </div>
      <div className="mt-1.5 truncate text-[11.5px] font-semibold leading-[1.3] text-secondary">
        {contributors === 0 ? 'nobody yet' : `from ${people(contributors)}`}
      </div>
    </div>
  );
}
