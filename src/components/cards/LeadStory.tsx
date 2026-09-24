'use client';

import Link from 'next/link';
import { Media, initialsFor } from '@/components/ui/Media';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { useArtifact } from '@/components/reactions/useArtifact';
import { cardTone, contributorPhrase } from '@/lib/domain/copy';
import { OpinionSplit } from './OpinionSplit';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactCard as ArtifactCardModel } from '@/lib/domain/types';
import { EggIcon, MedalIcon } from '@/components/ui/icons';

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
        className={`paper card-brutal tone-${badge.tone} media-hover grid gap-0 md:grid-cols-2`}
      >
        <Media
          src={card.imageUrl}
          alt=""
          fallbackLabel={initialsFor(card.title)}
          fallbackKind="initials"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
          className="aspect-[16/10] w-full md:h-full"
        />

        <div className="flex flex-col p-[clamp(20px,2.4vw,40px)]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flag">{card.category}</span>
            <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.1em] text-secondary">
              <RelativeTime iso={card.publishedAt} />
              {entityName && ` · Entity: ${entityName}`}
            </span>
          </div>

          <h2 className="display mt-4 text-pretty text-[clamp(28px,3.4vw,52px)]">
            <Link href={href} className="card-link">
              {card.title}
            </Link>
          </h2>

          {card.subtitle && (
            <p className="mt-4 max-w-[52ch] text-[clamp(15px,1.2vw,17.5px)] leading-[1.55] text-secondary">
              {card.subtitle}
            </p>
          )}

          <div className="mt-auto border-t-2 border-ink pt-5">
            {/* The verdict, ahead of the volume. */}
            <OpinionSplit totals={state.totals} size="lg" />

            <div className="mt-3.5 flex flex-wrap items-start gap-x-7 gap-y-4">
              <Total
                value={state.totals.medalTotal}
                label="Medals"
                mark="medal"
                tone="medal"
                contributors={state.totals.medalContributorTotal}
              />
              <Total
                value={state.totals.rottenEggTotal}
                label="Rotten eggs"
                mark="egg"
                tone="egg"
                contributors={state.totals.rottenEggContributorTotal}
              />

              {/* A cue, not a second link: the whole card already opens the story. */}
              <span
                aria-hidden="true"
                className="btn ml-auto flex-none self-end bg-ink px-5 py-3.5 text-[13px] font-extrabold text-paper"
              >
                Open story →
              </span>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

/** A tap total, never printed without the head count behind it. */
function Total({
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
        className="numeric-lg text-[clamp(34px,4vw,56px)]"
        style={{ color: tone === 'egg' ? 'var(--color-egg-deep)' : 'var(--color-medal-deep)' }}
      >
        {formatCount(value)}
      </div>
      <div className="mt-2 text-[10.5px] font-semibold uppercase leading-none tracking-[0.1em] text-secondary">
        {label} {mark === 'egg' ? <EggIcon /> : <MedalIcon />}
      </div>
      <div className="mt-1 text-[11px] font-medium leading-[1.3] text-tertiary">
        {contributorPhrase(mark === 'egg' ? 'rotten_egg' : 'medal', contributors).toLowerCase()}
      </div>
    </div>
  );
}
