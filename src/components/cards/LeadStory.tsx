'use client';

import Link from 'next/link';
import { Media, initialsFor } from '@/components/ui/Media';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { useArtifact } from '@/components/reactions/useArtifact';
import { cardTone } from '@/lib/domain/copy';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactCard as ArtifactCardModel } from '@/lib/domain/types';

/**
 * The lead story: one item given the whole width, image beside the headline.
 *
 * It is the same information as a card in the grid below, at a size that lets
 * the headline run at display scale and the two totals sit side by side. The
 * ribbon overlapping the top-left corner is what marks it as the lead rather
 * than merely the first.
 */
export function LeadStory({
  card,
  label = 'Lead story',
  entityName,
}: {
  card: ArtifactCardModel;
  label?: string;
  entityName?: string | null;
}) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const badge = cardTone(state.totals);
  const href = `/flash-news/${card.slug}`;

  return (
    <div className="relative">
      <span className="absolute -top-3 left-0 z-10 bg-ink px-3 py-2 text-[11px] font-bold uppercase leading-none tracking-[0.12em] text-paper">
        {label}
      </span>

      <article
        className={`paper tone-${badge.tone} media-hover grid gap-0 md:grid-cols-2`}
        style={{ boxShadow: 'var(--shadow-slab)' }}
      >
        <Link href={href} className="block" tabIndex={-1} aria-hidden="true">
          <Media
            src={card.imageUrl}
            alt=""
            fallbackLabel={initialsFor(card.title)}
            fallbackKind="initials"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
            className="aspect-[16/10] w-full md:h-full"
          />
        </Link>

        <div className="flex flex-col p-[clamp(20px,2.4vw,40px)]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flag">{card.category}</span>
            <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.1em] text-secondary">
              <RelativeTime iso={card.publishedAt} />
              {entityName && ` · Entity: ${entityName}`}
            </span>
          </div>

          <h2 className="display mt-4 text-pretty text-[clamp(28px,3.4vw,52px)]">
            <Link href={href} className="hover:text-[color:var(--color-egg-deep)]">
              {card.title}
            </Link>
          </h2>

          {card.subtitle && (
            <p className="mt-4 max-w-[52ch] text-[clamp(15px,1.2vw,17.5px)] leading-[1.55] text-secondary">
              {card.subtitle}
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-end gap-x-7 gap-y-4 border-t-2 border-ink pt-5">
            <Total value={state.totals.rottenEggTotal} label="Rotten eggs" emoji="🥚" tone="egg" />
            <Total value={state.totals.medalTotal} label="Medals" emoji="🏅" tone="medal" />

            <p className="max-w-[26ch] flex-1 text-xs leading-[1.45] text-secondary">
              <span className="numeric">{formatCount(state.totals.negativeOpinionTotal)}</span>{' '}
              {state.totals.negativeOpinionTotal === 1 ? 'person' : 'people'} critical,{' '}
              <span className="numeric">{formatCount(state.totals.positiveOpinionTotal)}</span> appreciative. One
              opinion each; the big numbers are taps.
            </p>

            <Link href={href} className="btn flex-none bg-ink px-5 py-3.5 text-[13px] font-extrabold text-paper">
              Open story →
            </Link>
          </div>
        </div>
      </article>
    </div>
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
        className="numeric-lg text-[clamp(34px,4vw,56px)]"
        style={{ color: tone === 'egg' ? 'var(--color-egg-deep)' : 'var(--color-medal-deep)' }}
      >
        {formatCount(value)}
      </div>
      <div className="mt-2 text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em] text-secondary">
        {label} <span className="emoji">{emoji}</span>
      </div>
    </div>
  );
}
