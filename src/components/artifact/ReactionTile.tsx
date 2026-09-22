'use client';

import Link from 'next/link';
import { useArtifact } from '@/components/reactions/useArtifact';
import { formatCount } from '@/lib/domain/format';
import { contributorPhrase } from '@/lib/domain/copy';
import type { ArtifactCard, ReactionType } from '@/lib/domain/types';
import { ReactionMark } from '@/components/ui/icons';

/**
 * One reaction total, sized for a card: the tone fills the tile, the total sits
 * on it at display scale, and the head count behind it reads underneath.
 *
 * It used to be a control. It no longer is, on purpose. Reacting from a card
 * would let an undecided person commit their opinion — permanently, since a
 * side cannot be changed — by tapping a button that never asked them to take a
 * position. The workflow lives on the item's own page, so that is where the
 * tile sends them; the numbers here are live, and read-only.
 */

const COPY = {
  rotten_egg: { label: 'Rotten eggs' },
  medal: { label: 'Medals' },
} as const satisfies Record<ReactionType, { label: string }>;

export function ReactionTile({ card, reactionType }: { card: ArtifactCard; reactionType: ReactionType }) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const isEgg = reactionType === 'rotten_egg';
  const href = card.type === 'entity' ? `/entities/${card.slug}` : `/flash-news/${card.slug}`;

  const total = isEgg ? state.totals.rottenEggTotal : state.totals.medalTotal;
  const contributors = isEgg
    ? state.totals.rottenEggContributorTotal
    : state.totals.medalContributorTotal;

  return (
    <Link
      href={href}
      className={`block border-2 border-ink p-3.5 ${isEgg ? 'bg-egg' : 'bg-medal'} text-ink`}
      aria-label={`${formatCount(total)} ${COPY[reactionType].label} for ${card.title}, ${contributorPhrase(
        reactionType,
        contributors,
      ).toLowerCase()}. Open it to react.`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-[10.5px] font-bold uppercase leading-none tracking-[0.12em] text-[rgb(23_20_15_/_0.7)]">
          {COPY[reactionType].label}
        </span>
        <ReactionMark reactionType={reactionType} size={17} />
      </span>

      <span className="numeric-lg mt-2 block text-[clamp(28px,3vw,40px)] text-ink">{formatCount(total)}</span>

      <span className="mt-1.5 block text-[11px] font-semibold leading-[1.3] text-[rgb(23_20_15_/_0.7)]">
        {contributorPhrase(reactionType, contributors)}
      </span>
    </Link>
  );
}
