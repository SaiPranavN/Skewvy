import { Hero } from '@/components/home/Hero';
import { HowItWorks } from '@/components/home/HowItWorks';
import { Leaderboards } from '@/components/home/Leaderboards';
import { CtaBand } from '@/components/home/CtaBand';
import { CardGrid } from '@/components/cards/CardGrid';
import { FilterBar } from '@/components/cards/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { getCurrentUser } from '@/lib/auth/current-user';
import { listFlashNews, listEntities, toCards } from '@/lib/services/content';
import { heatIndex, leaderboard } from '@/lib/services/trending';
import { siteTotals } from '@/lib/services/totals';
import { FLASH_NEWS_CATEGORIES } from '@/lib/domain/types';
import type { ArtifactCard } from '@/lib/domain/types';

export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;

  const [mostActive, latestFlashNews, topEntities, eggBoard, medalBoard, totals] = await Promise.all([
    heatIndex({ viewerId, limit: 8 }),
    listFlashNews({ limit: 12 }).then((items) => toCards({ flashNews: items }, { viewerId, withVelocity: true })),
    listEntities({ limit: 4 }).then((items) => toCards({ entities: items }, { viewerId, withVelocity: true })),
    leaderboard('heat', { viewerId, limit: 5 }),
    leaderboard('medals', { viewerId, limit: 5 }),
    siteTotals(),
  ]);

  /*
   * The deck mixes both artifact types on purpose: the first thing a visitor
   * sees below the hero should show that Flash News and Entities are both
   * reactable, not just one of them.
   */
  const seen = new Set<string>();
  const showcase = [...mostActive, ...latestFlashNews, ...topEntities].filter((card) => {
    const key = `${card.type}:${card.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // The featured slot wants a real event, not a standing record.
  const featured = showcase.find((card) => card.type === 'flash_news') ?? showcase[0] ?? null;

  const crowd = showcase
    .filter((card) => card.id !== featured?.id)
    .filter((card) => !category || card.category === category)
    .slice(0, 10);

  if (showcase.length === 0) {
    return (
      <div className="rail py-20">
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
    ...eggBoard.map((row) => row.card),
    ...medalBoard.map((row) => row.card),
  ];

  /* Only the categories actually present, so no filter leads to an empty grid. */
  const presentCategories = FLASH_NEWS_CATEGORIES.filter((value) =>
    showcase.some((card) => card.category === value),
  );

  return (
    <div className="page-enter flex flex-col gap-[clamp(44px,6vw,104px)]">
      <HydrateArtifacts cards={allCards} />

      <Hero featured={featured} totals={totals} isAuthenticated={Boolean(user)} />

      <section aria-labelledby="crowd-heading" className="rail">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h2 id="crowd-heading" className="display m-0 text-[clamp(30px,4vw,58px)]">
              What the crowd is on
            </h2>
            <p className="mt-3 text-[15px] leading-[1.5] text-secondary">Live now, give or take a refresh.</p>
          </div>

          <FilterBar basePath="/" categories={presentCategories} activeCategory={category ?? null} />
        </div>

        <div className="mt-[clamp(20px,2.6vw,38px)]">
          {crowd.length === 0 ? (
            <EmptyState
              title="Nothing in this category yet"
              description="Try another category, or see everything the crowd is reacting to."
              action={{ href: '/', label: 'Show everything' }}
            />
          ) : (
            <CardGrid cards={crowd} columns={5} priorityCount={5} />
          )}
        </div>
      </section>

      <HowItWorks />

      <Leaderboards eggs={eggBoard} medals={medalBoard} />

      <CtaBand />
    </div>
  );
}
