import Link from 'next/link';
import { Media, initialsFor } from '@/components/ui/Media';
import { formatCount, formatCompact } from '@/lib/domain/format';
import type { ArtifactCard, ReactionType } from '@/lib/domain/types';

export interface RankedItem {
  card: ArtifactCard;
  primaryCount: number;
  secondaryCount: number;
  recentChange: number;
}

/**
 * A ranking row, in the style of a published index: rank, thumbnail, title,
 * type, the primary total, the change inside the window, and the opposing total
 * kept compact. No card, no glow — just a list with hairline separators.
 */
export function RankedRow({
  item,
  rank,
  metric,
  windowLabel,
}: {
  item: RankedItem;
  rank: number;
  /** Which reaction the primary column is counting. */
  metric: ReactionType | 'activity';
  windowLabel: string;
}) {
  const { card } = item;
  const href = card.type === 'entity' ? `/entities/${card.slug}` : `/flash-news/${card.slug}`;

  const primaryTone =
    metric === 'rotten_egg' ? 'text-egg' : metric === 'medal' ? 'text-medal' : 'text-primary';
  const secondaryEmoji = metric === 'rotten_egg' ? '🏅' : '🥚';
  const primaryEmoji = metric === 'rotten_egg' ? '🥚' : metric === 'medal' ? '🏅' : '';

  return (
    <li>
      <Link
        href={href}
        className="media-hover group grid grid-cols-[1.75rem_3.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--border-subtle)] py-3 transition-colors duration-150 hover:bg-surface sm:gap-4 sm:py-4"
      >
        <span className="numeric text-sm text-tertiary tabular-nums">{String(rank).padStart(2, '0')}</span>

        <Media
          src={card.imageUrl}
          alt=""
          fallbackLabel={card.type === 'entity' ? initialsFor(card.title) : card.category.slice(0, 3)}
          fallbackKind={card.type === 'entity' ? 'initials' : 'category'}
          sizes="56px"
          className="aspect-square w-14 rounded-md"
        />

        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-primary">
            {card.title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-tertiary">
            <span>{card.type === 'entity' ? 'Entity' : 'Flash News'}</span>
            <span aria-hidden="true" className="text-disabled">
              ·
            </span>
            <span>{card.category}</span>
            <span aria-hidden="true" className="hidden text-disabled sm:inline">
              ·
            </span>
            <span className="hidden sm:inline">
              <span className="emoji">{secondaryEmoji}</span>{' '}
              <span className="numeric">{formatCompact(item.secondaryCount)}</span>
            </span>
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className={`numeric-lg block text-base font-semibold sm:text-lg ${primaryTone}`}>
            {primaryEmoji && (
              <span className="emoji mr-1.5 text-xs align-middle" aria-hidden="true">
                {primaryEmoji}
              </span>
            )}
            {formatCount(item.primaryCount)}
          </span>
          <span className="numeric mt-0.5 block text-xs text-tertiary">
            +{formatCompact(item.recentChange)} {windowLabel}
          </span>
        </span>
      </Link>
    </li>
  );
}
