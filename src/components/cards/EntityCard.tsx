'use client';

import Link from 'next/link';
import { Media, initialsFor } from '@/components/ui/Media';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { useArtifact } from '@/components/reactions/useArtifact';
import { cardTone } from '@/lib/domain/copy';
import { formatCount } from '@/lib/domain/format';
import { OpinionSplit } from './OpinionSplit';
import { ReactionSplit } from './ReactionSplit';
import type { ArtifactCard as ArtifactCardModel } from '@/lib/domain/types';

/**
 * The entity card.
 *
 * An entity is a standing record rather than an event, so this card leads with
 * identity — the mark, the name, what the thing is — and then shows where
 * people stand before what they sent.
 *
 * The people split comes first because it is the verdict the badge is
 * computed from; the reaction totals follow in a box of the same weight,
 * because how hard people feel is half the picture. Drawn from the taps, the
 * verdict would be a picture of who tapped hardest, which is not what a
 * standing record means.
 *
 * The whole card opens the entity: the title's link is stretched over it, so
 * there is one link to reach by keyboard and one thing a screen reader
 * announces, rather than three links to the same page.
 */
export function EntityCard({ card, priority = false }: { card: ArtifactCardModel; priority?: boolean }) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });

  const badge = cardTone(state.totals);
  const itemCount = card.relatedFlashNewsCount ?? 0;

  return (
    <article className={`paper card-brutal tone-${badge.tone} media-hover flex flex-col`}>
      {/*
        * The mark sits beside the name in the wide Entities grid and drops
        * above it in the narrower mixed grid on the home page — `min-w` on the
        * text block is what decides which, so one card serves both.
        */}
      <div className="flex flex-wrap items-start gap-3.5 p-4">
        <Media
          src={card.imageUrl}
          alt=""
          fallbackLabel={initialsFor(card.title)}
          fallbackKind="initials"
          sizes="72px"
          priority={priority}
          className="h-[72px] w-[72px] flex-none border-2 border-ink"
        />

        <div className="min-w-[170px] flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="chip bg-[rgb(23_20_15_/_0.08)]">{card.category}</span>
            <span className="tone-badge">{badge.entityLabel}</span>
          </div>

          <h3 className="display-sm text-pretty text-[22px]">
            <Link href={`/entities/${card.slug}`} className="card-link">
              {card.title}
            </Link>
          </h3>

          {card.subtitle && (
            <p className="mt-1.5 line-clamp-2 text-[14.5px] leading-[1.45] text-secondary">{card.subtitle}</p>
          )}
        </div>
      </div>

      <div className="px-4">
        <OpinionSplit totals={state.totals} />
      </div>

      <div className="px-4 pt-2.5">
        <ReactionSplit totals={state.totals} />
      </div>

      <div className="flex min-h-4 justify-end px-4 pb-4 pt-3.5">
        {itemCount > 0 && (
          <Link
            href={`/entities/${card.slug}#stories`}
            className="card-action border-b-2 border-[color:var(--color-indigo)] pb-0.5 text-[13px] font-bold leading-none"
          >
            {formatCount(itemCount)} {itemCount === 1 ? 'Story' : 'Stories'} →
          </Link>
        )}
      </div>

      {card.publishedAt && (
        <div className="mt-auto truncate border-t border-[var(--rule-subtle)] bg-[rgb(23_20_15_/_0.04)] px-4 py-3 text-xs leading-[1.5] text-secondary">
          Latest: <RelativeTime iso={card.publishedAt} />
        </div>
      )}
    </article>
  );
}
