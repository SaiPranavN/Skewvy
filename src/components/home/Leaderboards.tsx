import Link from 'next/link';
import { formatCount } from '@/lib/domain/format';
import type { LeaderboardRow } from '@/lib/services/trending';

/**
 * The two standings, side by side on the ground rather than on paper.
 *
 * They are a reference table, not an article, so they get hairlines and a dark
 * surface. The small line under each total is the count of people — printed
 * beside the taps precisely because the two numbers disagree, and the footer
 * says which is which.
 */
export function Leaderboards({ eggs, medals }: { eggs: LeaderboardRow[]; medals: LeaderboardRow[] }) {
  if (eggs.length === 0 && medals.length === 0) return null;

  return (
    <section aria-labelledby="standings-heading" className="rail">
      <h2 id="standings-heading" className="sr-only">
        Standings
      </h2>

      <div className="grid gap-[clamp(16px,2vw,32px)] lg:grid-cols-2">
        <Board
          title="Most eggs"
          emoji="🥚"
          titleClass="text-brand"
          valueClass="text-brand"
          rows={eggs}
          metric="eggs"
          note="Totals are taps. The small line counts people who took the critical side."
        />
        <Board
          title="Most medals"
          emoji="🏅"
          titleClass="text-medal"
          valueClass="text-medal"
          rows={medals}
          metric="medals"
          note="Totals are taps. The small line counts people who took the appreciative side."
        />
      </div>
    </section>
  );
}

function Board({
  title,
  emoji,
  titleClass,
  valueClass,
  rows,
  metric,
  note,
}: {
  title: string;
  emoji: string;
  titleClass: string;
  valueClass: string;
  rows: LeaderboardRow[];
  metric: 'eggs' | 'medals';
  note: string;
}) {
  return (
    <div className="border border-[var(--border-default)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] px-[clamp(16px,1.8vw,24px)] py-[clamp(14px,1.6vw,20px)]">
        <h3 className={`display-sm m-0 text-[clamp(22px,2.4vw,32px)] ${titleClass}`}>
          {title} <span className="emoji">{emoji}</span>
        </h3>
        <p className="eyebrow">Last 7 days</p>
      </div>

      {rows.length === 0 ? (
        <p className="px-[clamp(16px,1.8vw,24px)] py-8 text-sm text-tertiary">
          No reactions recorded in this window yet.
        </p>
      ) : (
        <ol>
          {rows.map((row, index) => {
            const href = row.card.type === 'entity' ? `/entities/${row.card.slug}` : `/flash-news/${row.card.slug}`;
            const people =
              metric === 'eggs' ? row.card.totals.negativeOpinionTotal : row.card.totals.positiveOpinionTotal;

            return (
              <li
                key={`${row.card.type}:${row.card.id}`}
                className="flex items-center gap-4 border-b border-[var(--border-subtle)] px-[clamp(16px,1.8vw,24px)] py-3.5 last:border-b-0"
              >
                <span className="numeric w-5 flex-none text-xs text-tertiary">{index + 1}</span>

                <span className="min-w-0 flex-1">
                  <Link href={href} className="block truncate text-[15px] font-bold text-primary hover:text-brand">
                    {row.card.title}
                  </Link>
                  <span className="mt-1 block truncate text-xs text-tertiary">
                    {row.card.category} · {row.card.subtitle}
                  </span>
                </span>

                <span className="flex-none text-right">
                  <span className={`numeric-lg block text-[22px] ${valueClass}`}>
                    {formatCount(row.primaryCount)}
                  </span>
                  <span className="mt-1 block text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-tertiary">
                    {formatCount(people)} {people === 1 ? 'person' : 'people'}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <p className="border-t border-[var(--border-default)] px-[clamp(16px,1.8vw,24px)] py-3.5 text-xs leading-[1.45] text-tertiary">
        {note}
      </p>
    </div>
  );
}
