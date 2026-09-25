'use client';

import Link from 'next/link';
import { Media, initialsFor } from '@/components/ui/Media';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { useArtifact } from '@/components/reactions/useArtifact';
import { cardTone } from '@/lib/domain/copy';
import type { ArtifactCard as ArtifactCardModel } from '@/lib/domain/types';
import { OpinionSplit } from './OpinionSplit';
import { ReactionSplit } from './ReactionSplit';

/**
 * The story card.
 *
 * A tone-coloured image well on top carrying the category and the state of the
 * crowd, then the headline and summary on paper, then the two totals.
 *
 * The badge and the colour come from the **opinion** counts, never the reaction
 * totals — one furious person tapping two hundred times must not make a card
 * read as a public condemnation. The reaction totals sit directly beneath, in a
 * box of the same size: how hard people reacted matters as much as where they
 * stand, and each total carries its head count so it is never read as a crowd.
 *
 * The totals are live but the card does not react: clicking anywhere on it
 * goes to the item, where the workflow and the rule about taking a side both
 * live. That is one link — the title's, stretched over the card — so keyboard
 * and screen-reader users meet it once rather than three times.
 */
export function ArtifactCard({ card, priority = false }: { card: ArtifactCardModel; priority?: boolean }) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const href = card.type === 'entity' ? `/entities/${card.slug}` : `/flash-news/${card.slug}`;

  const badge = cardTone(state.totals);

  return (
    <article className={`paper card-brutal tone-${badge.tone} media-hover flex flex-col`}>
      <div className="relative">
        <Media
          src={card.imageUrl}
          alt=""
          fallbackLabel={initialsFor(card.title)}
          fallbackKind="initials"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 340px"
          priority={priority}
          scrim={card.imageUrl ? 'card' : 'none'}
          className="aspect-[16/10] w-full"
        />

        <span className="chip absolute left-3 top-3">{card.category}</span>
        <span className="tone-badge absolute bottom-3 right-3">{badge.flashLabel}</span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.1em] text-secondary">
          {card.type === 'entity' ? 'Profile' : 'Story'} · <RelativeTime iso={card.publishedAt} />
        </p>

        <h3 className="display-sm text-pretty text-[19px]">
          <Link href={href} className="card-link">
            {card.title}
          </Link>
        </h3>

        {card.subtitle && (
          <p className="line-clamp-3 text-[14.5px] leading-[1.45] text-secondary">{card.subtitle}</p>
        )}

        <div className="mt-auto pt-2">
          <OpinionSplit totals={state.totals} />

          <div className="mt-2.5">
            <ReactionSplit totals={state.totals} />
          </div>

          {/* A cue, not a second link: the whole card already goes there. */}
          <div className="mt-3.5 flex justify-end">
            <span
              aria-hidden="true"
              className="border-b-2 border-[color:var(--color-egg)] pb-0.5 text-[13px] font-bold leading-none"
            >
              React →
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
