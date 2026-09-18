'use client';

import { useArtifact } from '@/components/reactions/useArtifact';
import { EggIcon, MedalIcon } from '@/components/ui/icons';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactCard } from '@/lib/domain/types';

/**
 * The side this viewer took, stated plainly.
 *
 * A stance is not a reaction total, so it does not wear carrot or gold: it is
 * red for critical and green for appreciative, the only two values it can
 * have. Nothing renders until a side exists — an empty "not recorded" card
 * would just be a box saying nothing.
 *
 * The count underneath is the viewer's own taps, kept visibly separate from
 * the opinion above it: one is unlimited, the other happens exactly once.
 */
export function YourOpinionCard({ card }: { card: ArtifactCard }) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const { stance, rottenEggCount, medalCount } = state.contribution;

  if (!stance) return null;

  const negative = stance === 'negative';
  const own = negative ? rottenEggCount : medalCount;

  return (
    <section
      aria-label="Your opinion"
      className={`mark-inherit mt-4 max-w-[520px] border-2 border-ink p-[clamp(16px,1.8vw,22px)] text-ink ${
        negative ? 'bg-[color:var(--color-negative)]' : 'bg-[color:var(--color-positive)]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow-ink">Your opinion</div>
          <div className="display mt-2 text-[clamp(30px,3.4vw,44px)]">{negative ? 'Negative' : 'Positive'}</div>
        </div>

        <span className="flex flex-none items-center gap-2" aria-hidden="true">
          {negative ? <EggIcon size={30} /> : <MedalIcon size={30} />}
        </span>
      </div>

      <p className="m-0 mt-3 max-w-[46ch] text-xs font-medium leading-[1.45] text-[rgb(23_20_15_/_0.75)]">
        Recorded once and final. {negative ? 'Eggs' : 'Medals'} stay unlimited —{' '}
        <span className="numeric font-bold">{formatCount(own)}</span> of the {negative ? 'eggs' : 'medals'} above{' '}
        {own === 1 ? 'is' : 'are'} yours.
      </p>
    </section>
  );
}
