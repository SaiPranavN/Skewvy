'use client';

import Link from 'next/link';
import { Media, initialsFor } from '@/components/ui/Media';
import { useArtifact } from '@/components/reactions/useArtifact';
import { cardTone } from '@/lib/domain/copy';
import { formatCount } from '@/lib/domain/format';
import type { RankedIndexItem } from '@/lib/services/trending';

/**
 * One line of a standings table: rank, mark, name, and the figure it is ranked
 * by at display scale.
 *
 * The number on the right is the whole point of the row, so it is the only
 * thing set large. The line under it says how much arrived in the window —
 * which is what the ranking is actually measuring, and rarely the same as the
 * lifetime total beside it.
 */
export function RankedRow({
  item,
  rank,
  metric,
  windowLabel,
}: {
  item: RankedIndexItem;
  rank: number;
  metric: 'rotten_egg' | 'medal' | 'activity';
  windowLabel: string;
}) {
  const { card } = item;
  const state = useArtifact(card.type, card.id, { totals: card.totals, contribution: card.contribution });
  const badge = cardTone(state.totals);

  const href = card.type === 'entity' ? `/entities/${card.slug}` : `/flash-news/${card.slug}`;
  const valueClass =
    metric === 'rotten_egg' ? 'text-brand' : metric === 'medal' ? 'text-medal' : 'text-primary';

  return (
    <li className={`tone-${badge.tone} flex items-center gap-4 border-b border-[var(--border-subtle)] py-3.5`}>
      <span className="numeric w-6 flex-none text-xs text-tertiary">{rank}</span>

      <Media
        src={card.imageUrl}
        alt=""
        fallbackLabel={initialsFor(card.title)}
        fallbackKind="initials"
        sizes="48px"
        className="h-12 w-12 flex-none border border-[var(--border-default)]"
      />

      <span className="min-w-0 flex-1">
        <Link href={href} className="block truncate text-[15px] font-bold text-primary hover:text-brand">
          {card.title}
        </Link>
        <span className="mt-1 block truncate text-xs text-tertiary">
          {card.type === 'entity' ? 'Profile' : 'Story'} · {card.category} · {badge.flashLabel}
        </span>
      </span>

      <span className="flex-none text-right">
        <span className={`numeric-lg block text-[24px] ${valueClass}`}>{formatCount(item.primaryCount)}</span>
        {item.recentChange > 0 && (
          <span className="mt-1 block text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-tertiary">
            +{formatCount(item.recentChange)} {windowLabel}
          </span>
        )}
      </span>
    </li>
  );
}
