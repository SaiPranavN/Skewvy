'use client';

import Link from 'next/link';
import { Media, initialsFor } from '@/components/ui/Media';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { useArtifact } from '@/components/reactions/useArtifact';
import { cardTone } from '@/lib/domain/copy';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactCard as ArtifactCardModel } from '@/lib/domain/types';

/**
 * The story card.
 *
 * A tone-coloured image well on top carrying the category and the state of the
 * crowd, then the headline and summary on paper, then the two totals at display
 * scale. The colour is read from the record, so a grid of these shows the shape
 * of the sentiment before any of it is read.
 *
 * The totals are live but the card does not react: tapping goes to the item,
 * where the full controls and the rule about taking a side both live.
 */
export function ArtifactCard({ card, priority = false }: { card: ArtifactCardModel; priority?: boolean }) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const href = card.type === 'entity' ? `/entities/${card.slug}` : `/flash-news/${card.slug}`;

  const badge = cardTone(state.totals);
  const critical = state.totals.negativeOpinionTotal;
  const appreciative = state.totals.positiveOpinionTotal;

  return (
    <article className={`paper tone-${badge.tone} media-hover flex flex-col`}>
      <Link href={href} className="block" tabIndex={-1} aria-hidden="true">
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
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.1em] text-secondary">
          {card.type === 'entity' ? 'Entity' : 'Flash News'} · <RelativeTime iso={card.publishedAt} />
        </p>

        <h3 className="display-sm text-pretty text-[19px]">
          <Link href={href} className="hover:text-[color:var(--color-egg-deep)]">
            {card.title}
          </Link>
        </h3>

        {card.subtitle && (
          <p className="line-clamp-3 text-[14.5px] leading-[1.45] text-secondary">{card.subtitle}</p>
        )}

        <div className="mt-auto pt-2">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3 border-t border-[var(--rule-subtle)] pt-3.5">
            <Total value={state.totals.rottenEggTotal} label="Eggs" emoji="🥚" tone="egg" />
            <Total value={state.totals.medalTotal} label="Medals" emoji="🏅" tone="medal" />

            <Link
              href={href}
              className="ml-auto border-b-2 border-[color:var(--color-egg)] pb-0.5 text-[13px] font-bold leading-none"
            >
              React →
            </Link>
          </div>

          <p className="mt-3 text-xs leading-[1.4] text-secondary">
            <span className="numeric">{formatCount(critical)}</span> {critical === 1 ? 'person' : 'people'} critical ·{' '}
            <span className="numeric">{formatCount(appreciative)}</span> appreciative
          </p>
        </div>
      </div>
    </article>
  );
}

function Total({
  value,
  label,
  emoji,
  tone,
}: {
  value: number;
  label: string;
  emoji: string;
  tone: 'egg' | 'medal';
}) {
  return (
    <div>
      <div
        className="numeric-lg text-[26px]"
        style={{ color: tone === 'egg' ? 'var(--color-egg-deep)' : 'var(--color-medal-deep)' }}
      >
        {formatCount(value)}
      </div>
      <div className="mt-1.5 text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em] text-secondary">
        {label} <span className="emoji">{emoji}</span>
      </div>
    </div>
  );
}
