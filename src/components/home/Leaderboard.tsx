import Image from 'next/image';
import Link from 'next/link';
import { formatCount, formatCompact } from '@/lib/domain/format';
import { leaderboardTag } from '@/lib/domain/copy';
import type { LeaderboardRow } from '@/lib/services/trending';

/**
 * Ranked list. The primary count is the lifetime total; the change column is
 * what arrived in the trailing 24 hours, which is what the ranking uses.
 */
export function Leaderboard({
  title,
  board,
  rows,
  metricLabel,
}: {
  title: string;
  board: 'heat' | 'medals';
  rows: LeaderboardRow[];
  metricLabel: string;
}) {
  const isHeat = board === 'heat';
  const emoji = isHeat ? '🥚' : '🏅';
  const accent = isHeat ? 'text-egg' : 'text-medal';

  return (
    <section className="glass rounded-[var(--radius-card)] p-5">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-chalk">
          <span className="emoji" aria-hidden="true">
            {emoji}
          </span>
          {title}
        </h2>
        <p className="mt-1 text-xs text-haze-dim">{metricLabel}</p>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-haze">
          Nothing has moved in the last 24 hours. Be the first to change that.
        </p>
      ) : (
        <ol className="space-y-1">
          {rows.map((row, index) => {
            const href = row.card.type === 'entity' ? `/entities/${row.card.slug}` : `/flash-news/${row.card.slug}`;
            return (
              <li key={`${row.card.type}:${row.card.id}`}>
                <Link
                  href={href}
                  className="group flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-white/6"
                >
                  <span className="w-5 shrink-0 text-center text-sm font-bold tabular text-haze-dim">{index + 1}</span>

                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10">
                    {row.card.imageUrl && (
                      <Image
                        src={row.card.imageUrl}
                        alt=""
                        fill
                        sizes="48px"
                        className="cover-image"
                      />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-chalk">{row.card.title}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-[0.6875rem] text-haze-dim">
                      <span className="rounded-full bg-white/8 px-1.5 py-0.5 uppercase tracking-[0.1em]">
                        {row.card.type === 'entity' ? 'Entity' : 'Flash News'}
                      </span>
                      <span>{leaderboardTag(index, board)}</span>
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className={`block text-base font-bold tabular ${accent}`}>
                      {formatCount(row.primaryCount)}
                    </span>
                    <span className="block text-[0.6875rem] text-haze-dim">
                      +{formatCompact(row.recentChange)} today
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
