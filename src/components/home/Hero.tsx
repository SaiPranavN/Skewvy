'use client';

import Link from 'next/link';
import { ReactionControl } from '@/components/reactions/ReactionControl';
import { CrowdSignal } from '@/components/reactions/CrowdSignal';
import { SentimentMarker, TypeLabel, MetaRow, MetaDot } from '@/components/ui/SentimentMarker';
import { SentimentBalance } from '@/components/ui/OpinionSummary';
import { Media, initialsFor } from '@/components/ui/Media';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { useArtifact } from '@/components/reactions/useArtifact';
import { HERO_HEADLINE, HERO_SUPPORT, MEASUREMENT_PRINCIPLE } from '@/lib/domain/copy';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactCard } from '@/lib/domain/types';

/**
 * Editorial hero: the product explained on the left, a live public counter on
 * the right. The featured artifact is real and interactive — the counter is
 * evidence the application works, not a screenshot of it.
 */
export function Hero({ featured }: { featured: ArtifactCard }) {
  const state = useArtifact(featured.type, featured.id, {
    totals: featured.totals,
    contribution: featured.contribution,
  });

  const href = featured.type === 'entity' ? `/entities/${featured.slug}` : `/flash-news/${featured.slug}`;

  return (
    <section className="mx-auto w-full max-w-[1320px] px-4 pb-12 pt-10 sm:px-6 lg:px-8 lg:pb-16 lg:pt-14">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-center lg:gap-16">
        <div>
          <h1 className="text-pretty text-[2rem] font-semibold leading-[1.08] tracking-[-0.03em] text-primary sm:text-[2.75rem] lg:text-[3.25rem]">
            {HERO_HEADLINE}
          </h1>

          <p className="mt-5 max-w-xl text-[0.9375rem] leading-relaxed text-secondary sm:text-base">{HERO_SUPPORT}</p>

          <p className="mt-4 max-w-xl border-l border-[var(--border-default)] pl-4 text-sm leading-relaxed text-tertiary">
            {MEASUREMENT_PRINCIPLE}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/flash-news"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-ground transition-opacity duration-150 hover:opacity-90"
            >
              Browse Flash News
            </Link>
            <Link href="/trending" className="group inline-flex items-center gap-1.5 text-sm text-secondary transition-colors duration-150 hover:text-primary">
              See what is most active
              <span
                aria-hidden="true"
                className="transition-transform duration-150 group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>
        </div>

        {/* The featured artifact: a public counter, not a scoreboard. */}
        <div className="panel overflow-hidden">
          <Link href={href} className="media-hover block">
            <Media
              src={featured.imageUrl}
              alt={featured.type === 'entity' ? `${featured.title} logo` : `Image for: ${featured.title}`}
              fallbackLabel={featured.type === 'entity' ? initialsFor(featured.title) : featured.category}
              fallbackKind={featured.type === 'entity' ? 'initials' : 'category'}
              sizes="(max-width: 1024px) 100vw, 440px"
              priority
              scrim={featured.imageUrl ? 'card' : 'none'}
              className="aspect-[16/9] w-full"
            />
          </Link>

          <div className="space-y-4 p-5">
            <MetaRow>
              <TypeLabel type={featured.type} />
              <MetaDot />
              <span>{featured.category}</span>
              <MetaDot />
              <RelativeTime iso={featured.publishedAt} />
            </MetaRow>

            <Link href={href}>
              <h2 className="text-pretty text-lg font-medium leading-snug text-primary">{featured.title}</h2>
            </Link>

            <div className="grid grid-cols-2 gap-2">
              <ReactionControl
                artifactType={featured.type}
                artifactId={featured.id}
                artifactTitle={featured.title}
                reactionType="rotten_egg"
                totals={featured.totals}
                contribution={featured.contribution}
                size="md"
              />
              <ReactionControl
                artifactType={featured.type}
                artifactId={featured.id}
                artifactTitle={featured.title}
                reactionType="medal"
                totals={featured.totals}
                contribution={featured.contribution}
                size="md"
              />
            </div>

            <SentimentBalance totals={state.totals} />

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-tertiary">
                <span className="numeric text-secondary">
                  {formatCount(state.totals.negativeOpinionTotal)}
                </span>{' '}
                critical ·{' '}
                <span className="numeric text-secondary">
                  {formatCount(state.totals.positiveOpinionTotal)}
                </span>{' '}
                appreciative
              </p>
              <CrowdSignal
                artifactType={featured.type}
                artifactId={featured.id}
                totals={featured.totals}
                contribution={featured.contribution}
              />
            </div>

            <SentimentMarker totals={state.totals} />
          </div>
        </div>
      </div>
    </section>
  );
}
