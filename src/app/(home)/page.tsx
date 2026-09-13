import Link from 'next/link';
import { Hero } from '@/components/home/Hero';
import { ShowcaseCarousel } from '@/components/home/ShowcaseCarousel';
import { Mission } from '@/components/home/Mission';
import { RankedRow } from '@/components/cards/RankedRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { getCurrentUser } from '@/lib/auth/current-user';
import { listFlashNews, listEntities, toCards } from '@/lib/services/content';
import { heatIndex, leaderboard } from '@/lib/services/trending';
import { heroImageUrl } from '@/lib/services/hero-image';
import { SECTION_TITLES } from '@/lib/domain/copy';
import type { ArtifactCard } from '@/lib/domain/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;

  const [mostActive, latestFlashNews, topEntities, scrutiny, recognition] = await Promise.all([
    heatIndex({ viewerId, limit: 6 }),
    listFlashNews({ limit: 6 }).then((items) => toCards({ flashNews: items }, { viewerId, withVelocity: true })),
    listEntities({ limit: 4 }).then((items) => toCards({ entities: items }, { viewerId, withVelocity: true })),
    leaderboard('heat', { viewerId, limit: 5 }),
    leaderboard('medals', { viewerId, limit: 5 }),
  ]);

  /*
   * The deck mixes both artifact types on purpose: the first thing a visitor
   * sees below the hero should show that Flash News and Entities are both
   * reactable, not just one of them.
   */
  const seen = new Set<string>();
  const showcase = [...mostActive, ...latestFlashNews, ...topEntities]
    .filter((card) => {
      const key = `${card.type}:${card.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);

  if (showcase.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-4 py-20 sm:px-6 lg:px-8">
        <EmptyState
          title="No published content yet"
          description="Publish an Entity or a Flash News item from the admin area and it appears here."
          action={{ href: '/admin', label: 'Open admin' }}
        />
      </div>
    );
  }

  const allCards: ArtifactCard[] = [
    ...showcase,
    ...scrutiny.map((row) => row.card),
    ...recognition.map((row) => row.card),
  ];

  return (
    <>
      <HydrateArtifacts cards={allCards} />

      <Hero imageUrl={heroImageUrl()} isAuthenticated={Boolean(user)} />

      <div className="page-enter">
        <section className="border-b border-[var(--border-subtle)] py-14 sm:py-16">
          <div className="mx-auto mb-8 w-full max-w-[1320px] px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-balance text-[1.5rem] font-medium tracking-[-0.02em] text-primary sm:text-[1.875rem]">
              Here is what people are reacting to
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-secondary">
              Tap a counter to react. Swipe or use the arrows to see more.
            </p>
          </div>

          <ShowcaseCarousel cards={showcase} />
        </section>

        <div className="mx-auto w-full max-w-[1320px] space-y-20 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <Mission />

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

          <section className="divider flex flex-wrap items-center justify-between gap-6 pt-12">
            <p className="max-w-xl text-pretty text-base leading-relaxed text-secondary sm:text-lg">
              News reports what happened. Skewvy records how strongly the public reacted, and how many people took each
              side.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={user ? '/flash-news' : '/register'}
                className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-ground transition-opacity duration-150 hover:opacity-90"
              >
                {user ? 'Browse Flash News' : 'Get started'}
              </Link>
              <Link
                href="/trending"
                className="inline-flex min-h-11 items-center rounded-md border border-[var(--border-default)] px-5 py-2.5 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)]"
              >
                See today&apos;s index
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
