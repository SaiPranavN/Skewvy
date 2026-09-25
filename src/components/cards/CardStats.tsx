import { formatCount, sharePercent } from '@/lib/domain/format';
import type { ArtifactTotals } from '@/lib/domain/types';

/**
 * A card's numbers in one compact frame: where people stand on the top row,
 * how hard they reacted on the bottom, at the same size.
 *
 * Columns are sides — Positive over Medals on the left, Negative over Rotten
 * Eggs on the right — so each reads down as one half of the argument, and the
 * card stays close to square. Each row carries its own share bar. The full
 * `OpinionSplit` / `ReactionSplit` pair is kept for wider layouts.
 */
export function CardStats({ totals }: { totals: ArtifactTotals }) {
  const positive = totals.positiveOpinionTotal;
  const negative = totals.negativeOpinionTotal;
  const people = positive + negative;
  const positiveShare = people > 0 ? sharePercent(positive, people) : 0;

  const medals = totals.medalTotal;
  const eggs = totals.rottenEggTotal;
  const taps = medals + eggs;
  const medalShare = taps > 0 ? sharePercent(medals, taps) : 0;

  const persons = (count: number) => `${formatCount(count)} ${count === 1 ? 'person' : 'people'}`;

  return (
    <div
      className="border-2 border-ink"
      role="group"
      aria-label={
        people === 0 && taps === 0
          ? 'No one has taken a side or reacted yet.'
          : `${persons(positive)} positive and ${persons(negative)} negative. ${formatCount(medals)} Medals from ${persons(
              totals.medalContributorTotal,
            )}, ${formatCount(eggs)} Rotten Eggs from ${persons(totals.rottenEggContributorTotal)}.`
      }
    >
      <div aria-hidden="true">
        <div className="grid grid-cols-2">
          <Cell
            mark={<span style={{ color: 'var(--color-positive-deep)' }}>▲</span>}
            label="Positive"
            value={positive}
            note={people > 0 ? `${positive === 1 ? 'person' : 'people'} · ${positiveShare}%` : 'people'}
            tint="rgb(34 197 94 / 0.14)"
            colour="var(--color-positive-deep)"
            divider
          />
          <Cell
            mark={<span style={{ color: 'var(--color-negative-deep)' }}>▼</span>}
            label="Negative"
            value={negative}
            note={people > 0 ? `${negative === 1 ? 'person' : 'people'} · ${100 - positiveShare}%` : 'people'}
            tint="rgb(239 68 68 / 0.12)"
            colour="var(--color-negative-deep)"
          />
        </div>
        <Bar left={people > 0 ? positiveShare : null} leftColour="var(--color-positive)" rightColour="var(--color-negative)" />

        <div className="grid grid-cols-2">
          <Cell
            mark={<span className="emoji emoji-medal">🏅</span>}
            label="Medals"
            value={medals}
            note={totals.medalContributorTotal > 0 ? `from ${persons(totals.medalContributorTotal)}` : 'none yet'}
            tint="rgb(255 200 40 / 0.2)"
            colour="var(--color-medal-deep)"
            divider
          />
          <Cell
            mark={<span className="emoji emoji-egg">🥚</span>}
            label="Eggs"
            value={eggs}
            note={totals.rottenEggContributorTotal > 0 ? `from ${persons(totals.rottenEggContributorTotal)}` : 'none yet'}
            tint="rgb(255 107 69 / 0.16)"
            colour="var(--color-egg-deep)"
          />
        </div>
        <Bar left={taps > 0 ? medalShare : null} leftColour="var(--color-medal)" rightColour="var(--color-egg)" last />
      </div>
    </div>
  );
}

function Cell({
  mark,
  label,
  value,
  note,
  tint,
  colour,
  divider = false,
}: {
  mark: React.ReactNode;
  label: string;
  value: number;
  note: string;
  tint: string;
  colour: string;
  divider?: boolean;
}) {
  return (
    <div
      className={`min-w-0 px-2.5 py-2 ${divider ? 'border-r-2 border-ink' : ''}`}
      style={{ backgroundColor: tint }}
    >
      <div className="flex h-3.5 items-center gap-1.5 text-[10px] font-bold uppercase leading-none tracking-[0.1em]">
        <span className="text-[11px] leading-none">{mark}</span>
        {label}
      </div>
      <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
        <span className="numeric-lg text-[22px] leading-none" style={{ color: colour }}>
          {formatCount(value)}
        </span>
        <span className="truncate text-[10.5px] font-semibold leading-none text-secondary">{note}</span>
      </div>
    </div>
  );
}

function Bar({
  left,
  leftColour,
  rightColour,
  last = false,
}: {
  left: number | null;
  leftColour: string;
  rightColour: string;
  last?: boolean;
}) {
  // Five pixels of colour; the ink rules around it separate the rows.
  return (
    <div
      className={`flex bg-[rgb(23_20_15_/_0.12)] ${last ? 'h-[7px] border-t-2' : 'h-[9px] border-y-2'} border-ink`}
    >
      {left !== null && (
        <>
          <span className="block h-full" style={{ width: `${left}%`, backgroundColor: leftColour }} />
          <span className="block h-full flex-1" style={{ backgroundColor: rightColour }} />
        </>
      )}
    </div>
  );
}
