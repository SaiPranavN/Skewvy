'use client';

import Link from 'next/link';
import { Media, initialsFor } from '@/components/ui/Media';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { useArtifact } from '@/components/reactions/useArtifact';
import { cardTone } from '@/lib/domain/copy';
import { SentimentLine } from './SentimentLine';
import { ReactionSplit } from './ReactionSplit';
import type { ArtifactCard as ArtifactCardModel } from '@/lib/domain/types';

/**
 * The lead story: one item given the whole width.
 *
 * The headline runs at display scale, but the image stays at ordinary card
 * size in a framed column with the numbers beneath it — images are uploaded
 * for a card, and stretching one across half the page is what made it blur.
 * The ribbon overlapping the top-left corner marks it as the lead, which an
 * editor chooses in the admin area (the newest Story when none is chosen).
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

      {/*
        * Three areas: the image, the text, the numbers. Stacked on a phone; on
        * a wide screen the image and the numbers share a column of ordinary
        * card width, so the picture is shown at the size it was made for and
        * the headline takes the rest.
        */}
      <article
        className={`paper card-brutal tone-${badge.tone} media-hover grid gap-x-[clamp(24px,3vw,48px)] gap-y-5 grid-cols-[minmax(0,1fr)] p-[clamp(16px,2vw,28px)] pt-[clamp(24px,2.6vw,32px)] [grid-template-areas:'image'_'text'_'stats'] lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:[grid-template-areas:'image_text'_'stats_text']`}
      >
        <Media
          src={card.imageUrl}
          alt=""
          fallbackLabel={initialsFor(card.relatedEntities?.[0]?.name ?? card.title)}
          fallbackKind="initials"
          sizes="(max-width: 1024px) 100vw, 440px"
          priority
          className="aspect-[16/9] w-full border-2 border-ink [grid-area:image]"
        />

        <div className="flex min-w-0 flex-col [grid-area:text] lg:py-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flag">{card.category}</span>
            <span className="tone-badge">{badge.flashLabel}</span>
            <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.1em] text-secondary">
              <RelativeTime iso={card.publishedAt} />
              {entityName && ` · Profile: ${entityName}`}
            </span>
          </div>

          <h2 className="display mt-4 text-pretty text-[clamp(28px,3.6vw,56px)]">
            <Link href={href} className="card-link">
              {card.title}
            </Link>
          </h2>

          {card.subtitle && (
            <p className="mt-4 max-w-[56ch] text-[clamp(15px,1.2vw,18px)] leading-[1.55] text-secondary">
              {card.subtitle}
            </p>
          )}

          {/* A cue, not a second link: the whole card already opens the story. */}
          <div className="mt-6 lg:mt-auto lg:pt-6">
            <span aria-hidden="true" className="btn inline-flex bg-ink px-5 py-3.5 text-[13px] font-extrabold text-paper">
              Open story →
            </span>
          </div>
        </div>

        <div className="space-y-3 [grid-area:stats]">
          <SentimentLine totals={state.totals} size="lg" />
          <ReactionSplit totals={state.totals} size="lg" />
        </div>
      </article>
    </div>
  );
}
