'use client';

import Link from 'next/link';
import { Media, initialsFor } from '@/components/ui/Media';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { useArtifact } from '@/components/reactions/useArtifact';
import { cardTone } from '@/lib/domain/copy';
import { formatCount } from '@/lib/domain/format';
import { SentimentLine } from './SentimentLine';
import { ReactionSplit } from './ReactionSplit';
import { cardDetailLine } from '@/lib/domain/details';
import type { ArtifactCard as ArtifactCardModel } from '@/lib/domain/types';

/**
 * The entity card.
 *
 * An entity is a standing record rather than an event, so this card leads with
 * identity — the mark, the name, what the thing is — and then shows where
 * people stand before what they sent.
 *
 * Mark, name and a line of facts ("Cricketer · India") up top, then where
 * people stand as a single line, and how hard they reacted as the big box
 * beneath it. The badge reads from the people, never the taps: drawn from the taps,
 * the verdict would be a picture of who tapped hardest, which is not what a
 * standing record means. Kept close to square so a grid of them scans.
 *
 * The whole card opens the entity: the title's link is stretched over it, so
 * there is one link to reach by keyboard and one thing a screen reader
 * announces, rather than three links to the same page.
 */
export function EntityCard({ card, priority = false }: { card: ArtifactCardModel; priority?: boolean }) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });

  const badge = cardTone(state.totals);
  const itemCount = card.relatedFlashNewsCount ?? 0;

  const detailLine = cardDetailLine(card.details);

  return (
    <article className={`paper card-brutal tone-${badge.tone} media-hover flex flex-col gap-3.5 p-4`}>
      {/* Mark beside the name, always: stacking them is what made the card tall. */}
      <div className="flex items-start gap-3">
        <Media
          src={card.imageUrl}
          alt=""
          fallbackLabel={initialsFor(card.title)}
          fallbackKind="initials"
          sizes="72px"
          priority={priority}
          className="h-[72px] w-[72px] flex-none border-2 border-ink"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip bg-[rgb(23_20_15_/_0.08)]">{card.category}</span>
            <span className="tone-badge">{badge.entityLabel}</span>
          </div>

          <h3 className="display-sm mt-2 line-clamp-2 text-pretty text-[22px] leading-[1.1]">
            <Link href={`/entities/${card.slug}`} className="card-link">
              {card.title}
            </Link>
          </h3>
        </div>
      </div>

      {(detailLine || card.subtitle) && (
        <div className="min-w-0">
          {detailLine && (
            <p className="truncate text-[12px] font-bold uppercase leading-[1.3] tracking-[0.05em] text-primary">
              {detailLine}
            </p>
          )}
          {card.subtitle && (
            <p className="mt-1.5 line-clamp-2 text-[14.5px] leading-[1.45] text-secondary">{card.subtitle}</p>
          )}
        </div>
      )}

      <div className="mt-auto space-y-3">
        <SentimentLine totals={state.totals} />
        <ReactionSplit totals={state.totals} />
      </div>

      <div className="flex items-center justify-between gap-3 text-[11.5px] leading-none text-secondary">
        <span className="truncate">
          {card.publishedAt ? (
            <>
              Updated <RelativeTime iso={card.publishedAt} />
            </>
          ) : null}
        </span>
        {itemCount > 0 && (
          <Link
            href={`/entities/${card.slug}#stories`}
            className="card-action flex-none border-b-2 border-[color:var(--color-indigo)] pb-0.5 text-[12.5px] font-bold text-primary"
          >
            {formatCount(itemCount)} {itemCount === 1 ? 'Story' : 'Stories'} →
          </Link>
        )}
      </div>
    </article>
  );
}
