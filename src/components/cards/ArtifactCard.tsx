'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRef } from 'react';
import { ReactionZone } from '@/components/reactions/ReactionZone';
import { CrowdPulse } from '@/components/reactions/CrowdPulse';
import { SentimentChip } from '@/components/ui/SentimentChip';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { useArtifact } from '@/components/reactions/useArtifact';
import { formatCount, sharePercent } from '@/lib/domain/format';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { pickFrom, ARTIFACT_MICROCOPY } from '@/lib/domain/copy';
import type { ArtifactCard as ArtifactCardModel } from '@/lib/domain/types';

/**
 * The feed card. Image-led and editorial, with the two reaction totals as the
 * loudest thing on it and the opinion split kept deliberately secondary.
 */
export function ArtifactCard({
  card,
  priority = false,
  size = 'default',
}: {
  card: ArtifactCardModel;
  priority?: boolean;
  size?: 'default' | 'wide';
}) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const containerRef = useRef<HTMLElement | null>(null);

  const href = card.type === 'entity' ? `/entities/${card.slug}` : `/flash-news/${card.slug}`;
  const negative = state.totals.negativeOpinionTotal;
  const positive = state.totals.positiveOpinionTotal;
  const people = negative + positive;
  const own = state.contribution;

  /** Subtle parallax on pointer devices; ignored by touch and reduced motion. */
  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') return;
    const element = containerRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    element.style.setProperty('--tilt-x', `${(-y * 3).toFixed(2)}deg`);
    element.style.setProperty('--tilt-y', `${(x * 3).toFixed(2)}deg`);
  };

  const resetTilt = () => {
    const element = containerRef.current;
    if (!element) return;
    element.style.setProperty('--tilt-x', '0deg');
    element.style.setProperty('--tilt-y', '0deg');
  };

  return (
    <article
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      className="card-lift group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-white/10 bg-ink-800/70"
      style={{
        // Glow derived from the card's own artwork accent.
        boxShadow: `0 0 0 1px rgb(255 255 255 / 0.03), 0 30px 70px -50px ${card.accent}`,
      }}
    >
      <Link href={href} className="relative block aspect-[16/10] overflow-hidden">
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={
              card.type === 'entity'
                ? `Cover artwork for ${card.title}`
                : `Cover artwork for the Flash News item: ${card.title}`
            }
            fill
            priority={priority}
            sizes={size === 'wide' ? '(max-width: 768px) 100vw, 800px' : '(max-width: 768px) 100vw, 420px'}
            className="cover-image transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="h-full w-full" style={{ background: `linear-gradient(140deg, ${card.accent}55, #0b0b13)` }} />
        )}

        <div className="cover-scrim absolute inset-0" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <TypeBadge type={card.type} />
          <SentimentChip totals={state.totals} />
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[0.6875rem] text-haze">
            <span className="rounded-full bg-white/10 px-2 py-0.5 font-medium text-chalk-dim">{card.category}</span>
            <RelativeTime iso={card.publishedAt} />
            {card.type === 'entity' && card.relatedFlashNewsCount !== undefined && (
              <span>
                {card.relatedFlashNewsCount} Flash News {card.relatedFlashNewsCount === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>
          <h3 className="text-balance text-lg font-semibold leading-snug text-chalk sm:text-xl">{card.title}</h3>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {card.subtitle && <p className="line-clamp-2 text-sm leading-relaxed text-haze">{card.subtitle}</p>}

        {card.relatedEntities && card.relatedEntities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-haze-dim">Related:</span>
            {card.relatedEntities.map((entity) => (
              <Link
                key={entity.id}
                href={`/entities/${entity.slug}`}
                className="rounded-full border border-white/12 px-2 py-0.5 font-medium text-chalk-dim transition-colors hover:border-white/30 hover:text-chalk"
              >
                {entity.name}
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <ReactionZone
            artifactType={card.type}
            artifactId={card.id}
            artifactTitle={card.title}
            reactionType="rotten_egg"
            totals={card.totals}
            contribution={card.contribution}
            size="compact"
          />
          <ReactionZone
            artifactType={card.type}
            artifactId={card.id}
            artifactTitle={card.title}
            reactionType="medal"
            totals={card.totals}
            contribution={card.contribution}
            size="compact"
          />
        </div>

        <div className="space-y-2">
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/8" aria-hidden="true">
            <div
              className="h-full bg-gradient-to-r from-egg-deep to-egg"
              style={{ width: `${sharePercent(negative, people)}%` }}
            />
            <div className="h-full flex-1 bg-gradient-to-r from-medal-deep to-medal" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-haze">
            <span>
              <span className="font-semibold text-chalk-dim">{formatCount(negative)}</span> frustrated ·{' '}
              <span className="font-semibold text-chalk-dim">{formatCount(positive)}</span> appreciative
            </span>
            <span className="text-haze-dim">{formatCount(state.totals.uniqueParticipantTotal)} people</span>
          </div>

          <div className="flex min-h-6 items-center justify-between gap-2">
            {own.rottenEggCount > 0 || own.medalCount > 0 ? (
              <p className="text-xs text-haze">
                You sent{' '}
                {own.rottenEggCount > 0 && (
                  <span className="font-semibold text-egg">
                    {formatCount(own.rottenEggCount)} <span className="emoji">🥚</span>
                  </span>
                )}
                {own.rottenEggCount > 0 && own.medalCount > 0 && ' · '}
                {own.medalCount > 0 && (
                  <span className="font-semibold text-medal">
                    {formatCount(own.medalCount)} <span className="emoji">🏅</span>
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-haze-dim">{pickFrom(ARTIFACT_MICROCOPY, card.slug)}</p>
            )}

            <CrowdPulse
              artifactType={card.type}
              artifactId={card.id}
              totals={card.totals}
              contribution={card.contribution}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
