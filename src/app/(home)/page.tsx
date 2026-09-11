import Link from 'next/link';
import { Hero } from '@/components/home/Hero';
import { HowItWorks } from '@/components/home/HowItWorks';
import { RankedRow } from '@/components/cards/RankedRow';
import { CardGrid } from '@/components/cards/CardGrid';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { getCurrentUser } from '@/lib/auth/current-user';
import { listFlashNews, listEntities, toCards } from '@/lib/services/content';
import { heatIndex, leaderboard } from '@/lib/services/trending';
import { SECTION_TITLES } from '@/lib/domain/copy';
import type { ArtifactCard } from '@/lib/domain/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;

  const [mostActive, recentFlashNews, scrutiny, recognition] = await Promise.all([
    heatIndex({ viewerId, limit: 8 }),
    listFlashNews({ limit: 7 }).then((items) => toCards({ flashNews: items }, { viewerId, withVelocity: true })),
    leaderboard('heat', { viewerId, limit: 5 }),
    leaderboard('medals', { viewerId, limit: 5 }),
  ]);

  const featured = mostActive[0] ?? recentFlashNews[0];

  if (!featured) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-4 py-20 sm:px-6 lg:px-8">
        <EmptyState
          title="No published content yet"
          description="Seed the demo data with npm run db:seed, or publish an Entity or Flash News item from the admin area."
          action={{ href: '/admin', label: 'Open admin' }}
        />
      </div>
    );
  }

  const feed = recentFlashNews.filter((card) => card.id !== featured.id).slice(0, 6);

  const allCards: ArtifactCard[] = [
    featured,
    ...mostActive,
    ...recentFlashNews,
    ...scrutiny.map((row) => row.card),
    ...recognition.map((row) => row.card),
  ];

  return (
    <div className="page-enter">
      <HydrateArtifacts cards={allCards} />
      <Hero featured={featured} />

      <div className="mx-auto w-full max-w-[1320px] space-y-16 px-4 pb-16 sm:px-6 lg:px-8">
        {feed.length > 0 && (
          <section aria-labelledby="latest-heading">
            <SectionHeader
              title={SECTION_TITLES.latest}
              description="Specific events, decisions and announcements the public is reacting to."
              action={{ href: '/flash-news', label: 'All Flash News' }}
            />
            <div id="latest-heading">
              <CardGrid cards={feed} priorityCount={2} />
            </div>
          </section>
        )}

        <section aria-labelledby="indices-heading" className="grid gap-12 lg:grid-cols-2 lg:gap-10">
          <h2 id="indices-heading" className="sr-only">
            Sentiment indices
          </h2>

          <div>
            <SectionHeader
              title={SECTION_TITLES.scrutiny}
              metricLabel="Ranked by Rotten Eggs received in the last 24 hours"
              className="mb-3"
            />
            {scrutiny.length === 0 ? (
              <p className="divider py-8 text-sm text-tertiary">No reactions recorded in the last 24 hours.</p>
            ) : (
              <ul className="border-t border-[var(--border-subtle)]">
                {scrutiny.map((row, index) => (
                  <RankedRow
                    key={`${row.card.type}:${row.card.id}`}
                    item={{
                      card: row.card,
                      primaryCount: row.card.totals.rottenEggTotal,
                      secondaryCount: row.card.totals.medalTotal,
                      recentChange: row.recentChange,
                    }}
                    rank={index + 1}
                    metric="rotten_egg"
                    windowLabel="today"
                  />
                ))}
              </ul>
            )}
          </div>

          <div>
            <SectionHeader
              title={SECTION_TITLES.recognition}
              metricLabel="Ranked by Medals received in the last 24 hours"
              className="mb-3"
            />
            {recognition.length === 0 ? (
              <p className="divider py-8 text-sm text-tertiary">No reactions recorded in the last 24 hours.</p>
            ) : (
              <ul className="border-t border-[var(--border-subtle)]">
                {recognition.map((row, index) => (
                  <RankedRow
                    key={`${row.card.type}:${row.card.id}`}
                    item={{
                      card: row.card,
                      primaryCount: row.card.totals.medalTotal,
                      secondaryCount: row.card.totals.rottenEggTotal,
                      recentChange: row.recentChange,
                    }}
                    rank={index + 1}
                    metric="medal"
                    windowLabel="today"
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="text-lg font-medium tracking-[-0.01em] text-primary sm:text-xl">
            How Skewvy counts
          </h2>
          <p className="mb-6 mt-1.5 max-w-2xl text-sm leading-relaxed text-secondary">
            Two numbers, measuring two different things.
          </p>
          <HowItWorks />
        </section>

        <section className="divider flex flex-wrap items-center justify-between gap-4 pt-10">
          <p className="max-w-xl text-pretty text-base leading-relaxed text-secondary sm:text-lg">
            News reports what happened. Skewvy records how strongly the public reacted, and how many people took each
            side.
          </p>
          <Link
            href="/trending"
            className="rounded-md border border-[var(--border-default)] px-5 py-2.5 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)]"
          >
            See today&apos;s index
          </Link>
        </section>
      </div>
    </div>
  );
}
