import Image from 'next/image';
import Link from 'next/link';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { SentimentChip } from '@/components/ui/SentimentChip';
import { ShareReceipt } from '@/components/share/ShareReceipt';
import { LocalDateTime } from '@/components/ui/TimeAgo';
import { pickFrom, HEAT_LINES } from '@/lib/domain/copy';
import type { ArtifactCard } from '@/lib/domain/types';

/** Cinematic header shared by Entity and Flash News pages. */
export function ArtifactHeader({
  card,
  timeLabel,
  shareUrl,
}: {
  card: ArtifactCard;
  timeLabel: string;
  shareUrl: string;
}) {
  return (
    <header className="relative">
      <div className="absolute inset-0 overflow-hidden">
        {card.imageUrl && (
          <Image
            src={card.imageUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="cover-image opacity-75"
          />
        )}
        <div className="cover-scrim-hero absolute inset-0" />
      </div>

      <div className="relative mx-auto w-full max-w-[1400px] px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-14 lg:px-10">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <TypeBadge type={card.type} />
          <SentimentChip totals={card.totals} />
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[0.6875rem] font-medium text-chalk-dim">
            {card.category}
          </span>
        </div>

        <h1 className="max-w-4xl text-balance text-[2rem] font-black leading-[1.02] tracking-[-0.03em] text-chalk sm:text-5xl lg:text-6xl">
          {card.title}
        </h1>

        {card.subtitle && (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-chalk-dim sm:text-lg">{card.subtitle}</p>
        )}

        <p className="mt-3 max-w-2xl text-sm italic text-haze">{pickFrom(HEAT_LINES, card.slug)}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="text-xs text-haze-dim">
            {timeLabel} <LocalDateTime iso={card.publishedAt} />
          </span>

          {card.relatedEntities && card.relatedEntities.length > 0 && (
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-haze-dim">
              <span>·</span>
              <span>Related:</span>
              {card.relatedEntities.map((entity) => (
                <Link
                  key={entity.id}
                  href={`/entities/${entity.slug}`}
                  className="rounded-full border border-white/14 px-2 py-0.5 font-medium text-chalk-dim transition-colors hover:border-white/30 hover:text-chalk"
                >
                  {entity.name}
                </Link>
              ))}
            </span>
          )}

          <span className="ml-auto">
            <ShareReceipt card={card} url={shareUrl} />
          </span>
        </div>
      </div>
    </header>
  );
}
