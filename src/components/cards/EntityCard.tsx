'use client';

import Link from 'next/link';
import { Media, initialsFor } from '@/components/ui/Media';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { useArtifact } from '@/components/reactions/useArtifact';
import { cardTone } from '@/lib/domain/copy';
import { formatCount, sharePercent } from '@/lib/domain/format';
import type { ArtifactCard as ArtifactCardModel } from '@/lib/domain/types';
import { EggIcon, MedalIcon } from '@/components/ui/icons';

/**
 * The entity card.
 *
 * An entity is a standing record rather than an event, so this card leads with
 * identity — the mark, the name, what the thing is — and then shows the
 * lifetime split as a bar before the two totals. The footer carries the most
 * recent thing that happened, which is the hook back into Flash News.
 */
export function EntityCard({ card, priority = false }: { card: ArtifactCardModel; priority?: boolean }) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });

  const badge = cardTone(state.totals);
  const eggs = state.totals.rottenEggTotal;
  const medals = state.totals.medalTotal;
  const eggShare = sharePercent(eggs, eggs + medals);

  const itemCount = card.relatedFlashNewsCount ?? 0;

  return (
    <article className={`paper tone-${badge.tone} media-hover flex flex-col`}>
      {/*
        * The mark sits beside the name in the wide Entities grid and drops
        * above it in the narrower mixed grid on the home page — `min-w` on the
        * text block is what decides which, so one card serves both.
        */}
      <div className="flex flex-wrap items-start gap-3.5 p-4">
        <Link href={`/entities/${card.slug}`} className="flex-none" tabIndex={-1} aria-hidden="true">
          <Media
            src={card.imageUrl}
            alt=""
            fallbackLabel={initialsFor(card.title)}
            fallbackKind="initials"
            sizes="72px"
            priority={priority}
            className="h-[72px] w-[72px] border-2 border-ink"
          />
        </Link>

        <div className="min-w-[170px] flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="chip bg-[rgb(23_20_15_/_0.08)]">{card.category}</span>
            <span className="tone-badge">{badge.entityLabel}</span>
          </div>

          <h3 className="display-sm text-pretty text-[22px]">
            <Link href={`/entities/${card.slug}`} className="hover:text-[color:var(--color-egg-deep)]">
              {card.title}
            </Link>
          </h3>

          {card.subtitle && (
            <p className="mt-1.5 line-clamp-2 text-[14.5px] leading-[1.45] text-secondary">{card.subtitle}</p>
          )}
        </div>
      </div>

      <div
        className="split-bar mx-4"
        role="img"
        aria-label={`Lifetime split: ${formatCount(eggs)} eggs, ${formatCount(medals)} medals.`}
      >
        <span style={{ width: `${eggs + medals > 0 ? eggShare : 50}%` }} />
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 px-4 pb-4 pt-3.5">
        <Lifetime value={eggs} label="Lifetime eggs" mark="egg" tone="egg" />
        <Lifetime value={medals} label="Lifetime medals" mark="medal" tone="medal" />

        {itemCount > 0 && (
          <Link
            href={`/entities/${card.slug}`}
            className="ml-auto border-b-2 border-[color:var(--color-indigo)] pb-0.5 text-[13px] font-bold leading-none"
          >
            {formatCount(itemCount)} Flash News {itemCount === 1 ? 'item' : 'items'} →
          </Link>
        )}
      </div>

      <div className="mt-auto border-t border-[var(--rule-subtle)] bg-[rgb(23_20_15_/_0.04)] px-4 py-3 text-xs leading-[1.5] text-secondary">
        {card.publishedAt && (
          <p className="truncate">
            Latest: <RelativeTime iso={card.publishedAt} />
          </p>
        )}
        <p>
          <span className="numeric">{formatCount(state.totals.negativeOpinionTotal)}</span> critical /{' '}
          <span className="numeric">{formatCount(state.totals.positiveOpinionTotal)}</span> appreciative people
        </p>
      </div>
    </article>
  );
}

function Lifetime({
  value,
  label,
  mark,
  tone,
}: {
  value: number;
  label: string;
  mark: 'egg' | 'medal';
  tone: 'egg' | 'medal';
}) {
  return (
    <div>
      <div
        className="numeric-lg text-[30px]"
        style={{ color: tone === 'egg' ? 'var(--color-egg-deep)' : 'var(--color-medal-deep)' }}
      >
        {formatCount(value)}
      </div>
      <div className="mt-1.5 text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em] text-secondary">
        {label} {mark === 'egg' ? <EggIcon /> : <MedalIcon />}
      </div>
    </div>
  );
}
