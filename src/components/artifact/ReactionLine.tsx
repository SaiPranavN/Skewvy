import { formatCount, sharePercent } from '@/lib/domain/format';
import type { ArtifactTotals } from '@/lib/domain/types';

/**
 * Medals against Rotten Eggs as one line: each total at its end, and a bar
 * between split by their share of all taps. The companion to `SentimentLine`,
 * which draws the same shape for people.
 */
export function ReactionLine({ totals }: { totals: ArtifactTotals }) {
  const medals = totals.medalTotal;
  const eggs = totals.rottenEggTotal;
  const taps = medals + eggs;
  const medalShare = taps > 0 ? sharePercent(medals, taps) : 0;
  const eggShare = taps > 0 ? 100 - medalShare : 0;

  const persons = (count: number) => `${formatCount(count)} ${count === 1 ? 'person' : 'people'}`;

  return (
    <div
      role="group"
      aria-label={
        taps === 0
          ? 'No reactions yet.'
          : `${formatCount(medals)} Medals (${medalShare}%) from ${persons(totals.medalContributorTotal)}, ${formatCount(
              eggs,
            )} Rotten Eggs (${eggShare}%) from ${persons(totals.rottenEggContributorTotal)}.`
      }
    >
      <div className="flex items-end justify-between gap-3" aria-hidden="true">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="emoji emoji-medal text-[20px]">🏅</span>
            <span className="numeric-lg text-[30px] leading-none text-[color:var(--color-medal-deep)]">
              {formatCount(medals)}
            </span>
          </div>
          <p className="m-0 mt-1 truncate text-[10.5px] font-bold uppercase leading-none tracking-[0.08em] text-secondary">
            Medals{taps > 0 && ` · ${medalShare}%`}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <div className="flex items-baseline justify-end gap-1.5">
            <span className="numeric-lg text-[30px] leading-none text-[color:var(--color-egg-deep)]">
              {formatCount(eggs)}
            </span>
            <span className="emoji emoji-egg text-[20px]">🥚</span>
          </div>
          <p className="m-0 mt-1 truncate text-[10.5px] font-bold uppercase leading-none tracking-[0.08em] text-secondary">
            {taps > 0 && `${eggShare}% · `}Rotten Eggs
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex h-4 overflow-hidden border-2 border-ink bg-[rgb(23_20_15_/_0.1)]" aria-hidden="true">
        {taps > 0 && (
          <>
            <span className="block h-full bg-[color:var(--color-medal)]" style={{ width: `${medalShare}%` }} />
            <span
              className={`block h-full flex-1 bg-[color:var(--color-egg)] ${
                medalShare > 0 && eggShare > 0 ? 'border-l-2 border-ink' : ''
              }`}
            />
          </>
        )}
      </div>

      <div className="mt-1.5 flex justify-between gap-3 text-[11px] font-semibold leading-none text-tertiary" aria-hidden="true">
        <span>{totals.medalContributorTotal > 0 ? `from ${persons(totals.medalContributorTotal)}` : 'none yet'}</span>
        <span>{totals.rottenEggContributorTotal > 0 ? `from ${persons(totals.rottenEggContributorTotal)}` : 'none yet'}</span>
      </div>
    </div>
  );
}
