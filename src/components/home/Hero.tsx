'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ReactionZone } from '@/components/reactions/ReactionZone';
import { CrowdPulse } from '@/components/reactions/CrowdPulse';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { SentimentChip } from '@/components/ui/SentimentChip';
import { useArtifact } from '@/components/reactions/useArtifact';
import { HERO_HEADLINE, HERO_SUPPORT, pickFrom, HEAT_LINES } from '@/lib/domain/copy';
import { formatCount } from '@/lib/domain/format';
import { RelativeTime } from '@/components/ui/TimeAgo';
import type { ArtifactCard } from '@/lib/domain/types';

/**
 * The hero is a live artifact, not a screenshot: the preview controls send real
 * reactions. The first thing anyone reads is the headline; the first thing they
 * touch is a counter.
 */
export function Hero({ featured }: { featured: ArtifactCard }) {
  const state = useArtifact(featured.type, featured.id, {
    totals: featured.totals,
    contribution: featured.contribution,
  });

  const href = featured.type === 'entity' ? `/entities/${featured.slug}` : `/flash-news/${featured.slug}`;

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        {featured.imageUrl && (
          <Image
            src={featured.imageUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="cover-image scale-105 opacity-70"
          />
        )}
        <div className="cover-scrim-hero absolute inset-0" />
      </div>

      <div className="relative mx-auto grid w-full max-w-[1400px] gap-10 px-4 pb-14 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-14 lg:px-10 lg:pb-20 lg:pt-24">
        <div>
          <p className="label-caps mb-4 inline-flex items-center gap-2 rounded-full border border-white/14 bg-black/40 px-3 py-1.5 text-chalk-dim backdrop-blur">
            <span className="emoji" aria-hidden="true">
              🥚
            </span>
            A global sentiment playground
            <span className="emoji" aria-hidden="true">
              🏅
            </span>
          </p>

          <h1 className="text-balance text-[2.5rem] font-black leading-[0.98] tracking-[-0.035em] text-chalk sm:text-6xl lg:text-7xl">
            {HERO_HEADLINE}
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-chalk-dim sm:text-lg">{HERO_SUPPORT}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/flash-news"
              className="rounded-full bg-brand px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-bright"
            >
              Enter the heat
            </Link>
            <Link
              href="/trending"
              className="rounded-full border border-white/20 bg-black/30 px-6 py-3.5 text-base font-semibold text-chalk backdrop-blur transition-colors hover:border-white/40"
            >
              See how the crowd votes
            </Link>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-haze">
            <span className="flex items-center gap-2">
              <span className="emoji text-lg" aria-hidden="true">
                🥚
              </span>
              Add to the pile
            </span>
            <span className="flex items-center gap-2">
              <span className="emoji text-lg" aria-hidden="true">
                🏅
              </span>
              Reward the rare W
            </span>
          </div>
        </div>

        {/* The featured artifact, live and tappable. */}
        <div className="glass-strong rounded-[28px] p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <TypeBadge type={featured.type} />
            <SentimentChip totals={state.totals} />
            <RelativeTime iso={featured.publishedAt} className="ml-auto text-xs text-haze-dim" />
          </div>

          <Link href={href} className="group block">
            <h2 className="text-balance text-xl font-bold leading-snug text-chalk transition-colors group-hover:text-white sm:text-2xl">
              {featured.title}
            </h2>
          </Link>

          <p className="mt-2 text-sm leading-relaxed text-haze">
            {pickFrom(HEAT_LINES, featured.slug)}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <ReactionZone
              artifactType={featured.type}
              artifactId={featured.id}
              artifactTitle={featured.title}
              reactionType="rotten_egg"
              totals={featured.totals}
              contribution={featured.contribution}
              microcopy="Add to the pile."
            />
            <ReactionZone
              artifactType={featured.type}
              artifactId={featured.id}
              artifactTitle={featured.title}
              reactionType="medal"
              totals={featured.totals}
              contribution={featured.contribution}
              microcopy="Reward the rare W."
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-haze">
            <span>
              <span className="font-semibold text-chalk-dim">
                {formatCount(state.totals.negativeOpinionTotal)}
              </span>{' '}
              people frustrated ·{' '}
              <span className="font-semibold text-chalk-dim">
                {formatCount(state.totals.positiveOpinionTotal)}
              </span>{' '}
              appreciative
            </span>
            <CrowdPulse
              artifactType={featured.type}
              artifactId={featured.id}
              totals={featured.totals}
              contribution={featured.contribution}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
