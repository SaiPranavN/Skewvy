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
import type { Metadata } from 'next';
import { JsonLd } from '@/components/seo/JsonLd';
import { CONTACT_EMAIL, SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

/*
 * Who this site is, in the vocabulary search engines read: the site and its
 * name (so a search for "skewvy" is matched to it), the organisation behind
 * it, and the site search, which Google can offer straight from a result.
 */
const SITE_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: ['skewvy.com', 'Skewvy.com'],
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${absoluteUrl('/search')}?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl('/apple-icon.png'),
    email: CONTACT_EMAIL,
    description: SITE_DESCRIPTION,
  },
];

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
   * sees should show that Stories and Profiles are both reactable, not just
   * one of them.
   */
  const seen = new Set<string>();
  const showcase = [...mostActive, ...latestFlashNews, ...topEntities].filter((card) => {
    const key = `${card.type}:${card.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // The busiest items first, whatever their kind; the grid below has the rest.
  const featured = showcase.slice(0, 10);

  const crowd = showcase.filter((card) => !category || card.category === category).slice(0, 10);

  if (showcase.length === 0) {
    return (
      <div className="rail py-20">
        <EmptyState
          title="No published content yet"
          description="Publish a Profile or a Story from the admin area and it appears here."
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
      <JsonLd data={SITE_JSON_LD} />
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
            <CardGrid cards={crowd} columns={4} priorityCount={4} />
          )}
        </div>
      </section>

      <HowItWorks />

      <Leaderboards eggs={eggBoard} medals={medalBoard} />

      <CtaBand />
    </div>
  );
}
