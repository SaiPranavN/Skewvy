'use client';

import { useArtifact } from '@/components/reactions/useArtifact';
import { TrendChart } from './TrendChart';
import { DistributionCharts } from './DistributionCharts';
import { MEASUREMENT_NOTE } from '@/lib/domain/copy';
import type { ArtifactCard } from '@/lib/domain/types';
import type { ArtifactTrends } from '@/lib/services/timeline';

/**
 * Everything the crowd has done to this item, told as two measurements rather
 * than one.
 *
 * The section exists because a single chart of Rotten Eggs against Medals
 * answers a question nobody actually asked. "Which side is winning?" is settled
 * by people, and people are counted once each; "how hard is each side
 * reacting?" is settled by taps, and taps are unlimited. Plotted together they
 * would produce a number with no meaning, so they are drawn separately, on
 * their own axes, each saying in words what one of its points counts.
 */
export function AnalyticsSection({ card, trends }: { card: ArtifactCard; trends: ArtifactTrends }) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const { totals } = state;

  return (
    <div>
      <div className="mb-[clamp(16px,2vw,26px)] flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h2 className="display m-0 text-[clamp(26px,3.4vw,48px)]">How this is being read</h2>
        <p className="m-0 max-w-[46ch] text-[14px] font-semibold leading-[1.45] text-secondary">
          {MEASUREMENT_NOTE}
        </p>
      </div>

      {/* Two histories, two axes, never one chart. */}
      <div className="flex flex-wrap items-start gap-[clamp(16px,2.2vw,32px)]">
        <TrendChart
          trend={trends.opinions}
          title="Public opinion over time"
          unitNote="Each point counts people, once each."
          negativeLabel="Critical"
          positiveLabel="Appreciative"
          liveNegative={totals.negativeOpinionTotal}
          livePositive={totals.positiveOpinionTotal}
          emptyNote="Not enough history yet. This chart appears once people have taken sides across more than one hour."
        />

        <TrendChart
          trend={trends.reactions}
          title="Reaction intensity over time"
          unitNote="Each point counts reaction taps, which are unlimited per person."
          negativeLabel="Rotten Eggs"
          positiveLabel="Medals"
          liveNegative={totals.rottenEggTotal}
          livePositive={totals.medalTotal}
          emptyNote="Not enough history yet. This chart appears once this has been reacted to across more than one hour."
        />
      </div>

      <div className="mt-[clamp(16px,2.2vw,32px)]">
        <DistributionCharts card={card} />
      </div>
    </div>
  );
}
