'use client';

import Link from 'next/link';
import { Media, initialsFor } from '@/components/ui/Media';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { useArtifact } from '@/components/reactions/useArtifact';
import { cardTone, contributorPhrase } from '@/lib/domain/copy';
import { formatCount } from '@/lib/domain/format';
import { OpinionSplit } from './OpinionSplit';
import type { ArtifactCard as ArtifactCardModel } from '@/lib/domain/types';
import { EggIcon, MedalIcon } from '@/components/ui/icons';

/**
 * The entity card.
 *
 * An entity is a standing record rather than an event, so this card leads with
 * identity — the mark, the name, what the thing is — and then shows where
 * people stand before what they sent.
 *
 * The people split leads, at size, because it is the verdict the badge is
 * computed from. The reaction totals follow, smaller, as intensity. Drawn from
 * the taps instead, the split would be a picture of who tapped hardest, which
 * is not what a standing record means.
 *
 * The whole card opens the entity: the title's link is stretched over it, so
 * there is one link to reach by keyboard and one thing a screen reader
 * announces, rather than three links to the same page.
 */
export function EntityCard({ card, priority = false }: { card: ArtifactCardModel; priority?: boolean }) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });

  const badge = cardTone(state.totals);
  const eggs = state.totals.rottenEggTotal;
  const medals = state.totals.medalTotal;

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

      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 px-4 pb-4 pt-3.5">
        <Lifetime
          value={medals}
          label="Medals"
          mark="medal"
          tone="medal"
          contributors={state.totals.medalContributorTotal}
        />
        <Lifetime
          value={eggs}
          label="Rotten Eggs"
          mark="egg"
          tone="egg"
          contributors={state.totals.rottenEggContributorTotal}
        />

        {itemCount > 0 && (
          <Link
            href={`/entities/${card.slug}#stories`}
            className="card-action ml-auto self-end border-b-2 border-[color:var(--color-indigo)] pb-0.5 text-[13px] font-bold leading-none"
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

/** A lifetime tap total, with the head count behind it attached. */
function Lifetime({
  value,
  label,
  mark,
  tone,
  contributors,
}: {
  value: number;
  label: string;
  mark: 'egg' | 'medal';
  tone: 'egg' | 'medal';
  contributors: number;
}) {
  return (
    <div className="min-w-0">
      <div
        className="numeric-lg text-[22px]"
        style={{ color: tone === 'egg' ? 'var(--color-egg-deep)' : 'var(--color-medal-deep)' }}
      >
        {formatCount(value)}
      </div>
      <div className="mt-1.5 text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em] text-secondary">
        {label} {mark === 'egg' ? <EggIcon /> : <MedalIcon />}
      </div>
      <div className="mt-1 text-[10.5px] font-medium leading-[1.3] text-tertiary">
        {contributorPhrase(mark === 'egg' ? 'rotten_egg' : 'medal', contributors).toLowerCase()}
      </div>
    </div>
  );
}
