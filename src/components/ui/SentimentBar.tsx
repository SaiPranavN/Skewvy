import { formatCount, sharePercent } from '@/lib/domain/format';
import type { ArtifactTotals } from '@/lib/domain/types';

/**
 * Balance of opinion — people, not taps. The counts lead; the percentage is a
 * whole number so it never twitches with fake precision.
 */
export function SentimentBar({ totals, showLabels = true }: { totals: ArtifactTotals; showLabels?: boolean }) {
  const negative = totals.negativeOpinionTotal;
  const positive = totals.positiveOpinionTotal;
  const people = negative + positive;
  const negativeShare = sharePercent(negative, people);

  return (
    <div>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/8"
        role="img"
        aria-label={`Opinion split: ${formatCount(negative)} people frustrated, ${formatCount(positive)} people appreciative.`}
      >
        <div className="h-full bg-gradient-to-r from-egg-deep to-egg" style={{ width: `${negativeShare}%` }} />
        <div className="h-full flex-1 bg-gradient-to-r from-medal-deep to-medal" />
      </div>

      {showLabels && (
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[0.8125rem]">
          <span className="text-haze">
            <span className="font-semibold text-chalk-dim">{formatCount(negative)}</span> people frustrated
          </span>
          <span className="text-haze-dim">{people > 0 ? `${negativeShare}% / ${100 - negativeShare}%` : 'No opinions yet'}</span>
          <span className="text-haze">
            <span className="font-semibold text-chalk-dim">{formatCount(positive)}</span> people appreciative
          </span>
        </div>
      )}
    </div>
  );
}
