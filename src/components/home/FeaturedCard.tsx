'use client';

import Link from 'next/link';
import { ReactionTile } from '@/components/artifact/ReactionTile';
import { Media, initialsFor } from '@/components/ui/Media';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { useArtifact } from '@/components/reactions/useArtifact';
import { cardTone } from '@/lib/domain/copy';
import { OpinionSplit } from '@/components/cards/OpinionSplit';
import type { ArtifactCard } from '@/lib/domain/types';

/**
 * The item shown beside the hero headline.
 *
 * It is a real item with live totals rather than an illustration — the point of
 * the landing page is that the thing being described is right there and already
 * moving. Reacting happens on the item's own page: taking a side is permanent,
 * and nobody should do it from a tile that never asked them to choose one.
 */
export function FeaturedCard({ card }: { card: ArtifactCard }) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const badge = cardTone(state.totals);
  const href = card.type === 'entity' ? `/entities/${card.slug}` : `/flash-news/${card.slug}`;

  return (
    <div className="relative">
      <span className="absolute -top-3 left-0 z-10 bg-[color:var(--color-indigo)] px-3 py-2 text-[11px] font-bold uppercase leading-none tracking-[0.12em] text-paper">
        Featured
      </span>

      <article
        className={`paper card-brutal tone-${badge.tone} media-hover flex flex-col`}
      >
        <Media
          src={card.imageUrl}
          alt=""
          fallbackLabel={initialsFor(card.title)}
          fallbackKind="initials"
          sizes="(max-width: 1024px) 100vw, 640px"
          priority
          className="aspect-[16/9] w-full"
        />

        <div className="flex flex-col gap-3 p-[clamp(16px,1.6vw,22px)]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flag">{card.category}</span>
            <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.1em] text-secondary">
              {badge.flashLabel} · <RelativeTime iso={card.publishedAt} />
            </span>
          </div>

          <h2 className="display-sm text-pretty text-[clamp(22px,2.2vw,30px)]">
            <Link href={href} className="card-link">
              {card.title}
            </Link>
          </h2>

          {card.subtitle && (
            <p className="line-clamp-2 text-[14.5px] leading-[1.5] text-secondary">{card.subtitle}</p>
          )}

          {/* The verdict first, then the volume — the same order as every card. */}
          <OpinionSplit totals={state.totals} size="lg" />

          <div className="grid grid-cols-2 gap-3">
            <ReactionTile card={card} reactionType="rotten_egg" />
            <ReactionTile card={card} reactionType="medal" />
          </div>

          <p className="text-xs leading-[1.45] text-secondary">
            People count once each. The reaction totals count taps, which are unlimited per person.
          </p>
        </div>
      </article>
    </div>
  );
}
