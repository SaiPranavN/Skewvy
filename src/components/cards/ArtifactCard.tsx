'use client';

import Link from 'next/link';
import { ReactionControl } from '@/components/reactions/ReactionControl';
import { CrowdSignal } from '@/components/reactions/CrowdSignal';
import { SentimentMarker, TypeLabel, MetaRow, MetaDot } from '@/components/ui/SentimentMarker';
import { SentimentBalance, OpinionLine } from '@/components/ui/OpinionSummary';
import { Media, initialsFor } from '@/components/ui/Media';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { useArtifact } from '@/components/reactions/useArtifact';
import type { ArtifactCard as ArtifactCardModel } from '@/lib/domain/types';

/**
 * The editorial story card.
 *
 * Hierarchy: image, headline, context, reaction totals, then public opinion.
 * Every card uses the same neutral surface — the content, the image and the
 * numbers differentiate them, not colour.
 */
export function ArtifactCard({ card, priority = false }: { card: ArtifactCardModel; priority?: boolean }) {
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const href = card.type === 'entity' ? `/entities/${card.slug}` : `/flash-news/${card.slug}`;

  return (
    <article className="panel panel-interactive media-hover flex flex-col overflow-hidden">
      <Link href={href} className="block">
        <Media
          src={card.imageUrl}
          alt={card.type === 'entity' ? `${card.title} logo` : `Image for: ${card.title}`}
          fallbackLabel={card.type === 'entity' ? initialsFor(card.title) : card.category}
          fallbackKind={card.type === 'entity' ? 'initials' : 'category'}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"
          priority={priority}
          scrim={card.imageUrl ? 'card' : 'none'}
          className="aspect-[16/9] w-full"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <MetaRow>
          <TypeLabel type={card.type} />
          <MetaDot />
          <span>{card.category}</span>
          <MetaDot />
          <RelativeTime iso={card.publishedAt} />
        </MetaRow>

        <Link href={href} className="group">
          <h3 className="text-pretty text-[0.9375rem] font-medium leading-snug text-primary sm:text-base">
            {card.title}
          </h3>
        </Link>

        {card.subtitle && <p className="line-clamp-2 text-sm leading-relaxed text-secondary">{card.subtitle}</p>}

        {card.relatedEntities && card.relatedEntities.length > 0 && (
          <MetaRow>
            {card.relatedEntities.map((entity, index) => (
              <span key={entity.id} className="flex items-center gap-2">
                {index > 0 && <MetaDot />}
                <Link
                  href={`/entities/${entity.slug}`}
                  className="text-secondary underline-offset-2 transition-colors duration-150 hover:text-primary hover:underline"
                >
                  {entity.name}
                </Link>
              </span>
            ))}
          </MetaRow>
        )}

        <div className="mt-auto space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <ReactionControl
              artifactType={card.type}
              artifactId={card.id}
              artifactTitle={card.title}
              reactionType="rotten_egg"
              totals={card.totals}
              contribution={card.contribution}
              size="md"
            />
            <ReactionControl
              artifactType={card.type}
              artifactId={card.id}
              artifactTitle={card.title}
              reactionType="medal"
              totals={card.totals}
              contribution={card.contribution}
              size="md"
            />
          </div>

          <SentimentBalance totals={state.totals} />

          <div className="flex min-h-5 items-center justify-between gap-3">
            <OpinionLine totals={state.totals} />
            <CrowdSignal
              artifactType={card.type}
              artifactId={card.id}
              totals={card.totals}
              contribution={card.contribution}
            />
          </div>

          <SentimentMarker totals={state.totals} />
        </div>
      </div>
    </article>
  );
}
