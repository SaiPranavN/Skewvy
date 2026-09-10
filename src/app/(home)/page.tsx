import Link from 'next/link';
import { Hero } from '@/components/home/Hero';
import { HowItWorks } from '@/components/home/HowItWorks';
import { Leaderboard } from '@/components/home/Leaderboard';
import { CardGrid } from '@/components/cards/CardGrid';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { getCurrentUser } from '@/lib/auth/current-user';
import { listFlashNews, listEntities, toCards } from '@/lib/services/content';
import { heatIndex, mostMedalsToday, leaderboard } from '@/lib/services/trending';
import type { ArtifactCard } from '@/lib/domain/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;

  const [heat, medals, recentFlashNews, topEntities, heatBoard, medalBoard] = await Promise.all([
    heatIndex({ viewerId, limit: 6 }),
    mostMedalsToday({ viewerId, limit: 3 }),
    listFlashNews({ limit: 6 }).then((items) => toCards({ flashNews: items }, { viewerId, withVelocity: true })),
    listEntities({ limit: 3 }).then((items) => toCards({ entities: items }, { viewerId, withVelocity: true })),
    leaderboard('heat', { viewerId, limit: 5 }),
    leaderboard('medals', { viewerId, limit: 5 }),
  ]);

  const featured = heat[0] ?? recentFlashNews[0];
  const catchingHeat = heat.filter((card) => card.id !== featured?.id).slice(0, 3);

  const allCards: ArtifactCard[] = [
    ...(featured ? [featured] : []),
    ...heat,
    ...medals,
    ...recentFlashNews,
    ...topEntities,
    ...heatBoard.map((row) => row.card),
    ...medalBoard.map((row) => row.card),
  ];

  if (!featured) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-24 sm:px-6 lg:px-10">
        <EmptyState
          title="Nothing is on trial yet"
          description="No published content. Seed the demo world with `npm run db:seed`, or add an Entity or Flash News item from the admin area."
          action={{ href: '/admin', label: 'Open admin' }}
        />
      </div>
    );
  }

  return (
    <>
      <HydrateArtifacts cards={allCards} />
      <Hero featured={featured} />

      <div className="mx-auto w-full max-w-[1400px] space-y-20 px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
        <section aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="sr-only">
            How Skewvy works
          </h2>
          <HowItWorks />
        </section>

        {catchingHeat.length > 0 && (
          <section aria-labelledby="catching-heat">
            <SectionHeader
              eyebrow="Right now"
              title="Currently catching heat"
              description="The crowd is not impressed, and the counters show it."
              metricLabel="Ranked by reactions in the last 24 hours"
              action={{ href: '/trending', label: 'The heat index' }}
            />
            <div id="catching-heat">
              <CardGrid cards={catchingHeat} priorityCount={1} />
            </div>
          </section>
        )}

        {medals.length > 0 && (
          <section aria-labelledby="earning-medals">
            <SectionHeader
              eyebrow="Credit where due"
              title="Unexpectedly earning medals"
              description="Occasionally somebody gets it right and the crowd notices."
              metricLabel="Ranked by Medals in the last 24 hours"
            />
            <div id="earning-medals">
              <CardGrid cards={medals} />
            </div>
          </section>
        )}

        <section aria-labelledby="leaderboards" className="grid gap-5 lg:grid-cols-2">
          <h2 id="leaderboards" className="sr-only">
            Leaderboards
          </h2>
          <Leaderboard
            title="Getting the most heat"
            board="heat"
            rows={heatBoard}
            metricLabel="Ranked by Rotten Eggs received in the last 24 hours"
          />
          <Leaderboard
            title="Earning their medals"
            board="medals"
            rows={medalBoard}
            metricLabel="Ranked by Medals received in the last 24 hours"
          />
        </section>

        <section aria-labelledby="the-internet-has-opinions">
          <SectionHeader
            eyebrow="Flash News"
            title="The internet has opinions"
            description="Every headline gets the crowd it deserves."
            action={{ href: '/flash-news', label: 'All Flash News' }}
          />
          <div id="the-internet-has-opinions">
            <CardGrid cards={recentFlashNews} />
          </div>
        </section>

        <section aria-labelledby="entities-preview">
          <SectionHeader
            eyebrow="Entities"
            title="Subjects with a permanent record"
            description="Companies, clubs, studios and public bodies that keep accumulating public mood."
            action={{ href: '/entities', label: 'Browse Entities' }}
          />
          <div id="entities-preview">
            <CardGrid cards={topEntities} />
          </div>
        </section>

        <section className="glass-strong relative overflow-hidden rounded-[32px] px-6 py-14 text-center sm:px-12 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_20rem_at_50%_0%,rgb(224_72_60/0.22),transparent_70%)]"
          />
          <p className="relative label-caps text-brand-bright">The closing argument</p>
          <p className="relative mx-auto mt-4 max-w-3xl text-balance text-2xl font-bold leading-snug text-chalk sm:text-4xl">
            News tells you what happened. Skewvy shows who got cooked, who earned the medals, and how hard the crowd
            felt it.
          </p>
          <Link
            href="/flash-news"
            className="relative mt-8 inline-block rounded-full bg-brand px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-brand-bright"
          >
            See what&apos;s catching fire
          </Link>
        </section>
      </div>
    </>
  );
}
