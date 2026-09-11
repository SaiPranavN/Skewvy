import Link from 'next/link';
import { Media, initialsFor } from '@/components/ui/Media';
import { TypeLabel, MetaRow, MetaDot } from '@/components/ui/SentimentMarker';
import { LocalDateTime } from '@/components/ui/TimeAgo';
import { ShareReceipt } from '@/components/share/ShareReceipt';
import type { ArtifactCard } from '@/lib/domain/types';

/**
 * Editorial detail header. Context, image and metadata live here; public
 * reaction is a separate column, so fact and sentiment never blur together.
 */
export function ArtifactHeader({
  card,
  timeLabel,
  shareUrl,
  sourceLabel,
  sourceUrl,
}: {
  card: ArtifactCard;
  timeLabel: string;
  shareUrl: string;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
}) {
  return (
    <header className="space-y-5">
      <MetaRow>
        <TypeLabel type={card.type} />
        <MetaDot />
        <span>{card.category}</span>
        <MetaDot />
        <span>
          {timeLabel} <LocalDateTime iso={card.publishedAt} />
        </span>
      </MetaRow>

      <h1 className="text-pretty text-[1.75rem] font-semibold leading-[1.12] tracking-[-0.025em] text-primary sm:text-[2.25rem] lg:text-[2.5rem]">
        {card.title}
      </h1>

      {card.subtitle && (
        <p className="max-w-2xl text-base leading-relaxed text-secondary">{card.subtitle}</p>
      )}

      <Media
        src={card.imageUrl}
        alt={card.type === 'entity' ? `${card.title} logo` : `Image for: ${card.title}`}
        fallbackLabel={card.type === 'entity' ? initialsFor(card.title) : card.category}
        fallbackKind={card.type === 'entity' ? 'initials' : 'category'}
        sizes="(max-width: 1024px) 100vw, 760px"
        priority
        scrim={card.imageUrl ? 'card' : 'none'}
        className="aspect-[16/9] w-full rounded-[var(--radius-card)] border border-[var(--border-subtle)]"
      />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <MetaRow>
          {sourceLabel && (
            <>
              <span>
                Source:{' '}
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    className="text-secondary underline underline-offset-2 hover:text-primary"
                  >
                    {sourceLabel}
                  </a>
                ) : (
                  <span className="text-secondary">{sourceLabel}</span>
                )}
              </span>
              <MetaDot />
            </>
          )}

          {card.relatedEntities && card.relatedEntities.length > 0 ? (
            <span className="flex flex-wrap items-center gap-x-2">
              <span>Related:</span>
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
            </span>
          ) : null}
        </MetaRow>

        <ShareReceipt card={card} url={shareUrl} />
      </div>
    </header>
  );
}
