import type { Metadata } from 'next';
import { CardGrid } from '@/components/cards/CardGrid';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { getCurrentUser } from '@/lib/auth/current-user';
import { trendingSections } from '@/lib/services/trending';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trending',
  description: 'Ranked by recent reaction velocity, not lifetime totals.',
};

export default async function TrendingPage() {
  const user = await getCurrentUser();
  const sections = await trendingSections({ viewerId: user?.id ?? null });
  const allCards = sections.flatMap((section) => section.cards);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <HydrateArtifacts cards={allCards} />

      <header className="mb-10 max-w-3xl">
        <p className="label-caps mb-3 text-brand-bright">Trending</p>
        <h1 className="text-balance text-4xl font-black leading-[1.02] tracking-[-0.03em] text-chalk sm:text-5xl">
          The heat index
        </h1>
        <p className="mt-4 text-base leading-relaxed text-haze">
          Ranked by how fast reactions are arriving right now, not by who has been collecting them the longest. Each
          section says exactly what it is counting.
        </p>
      </header>

      {sections.length === 0 ? (
        <EmptyState
          title="The counters are quiet"
          description="No reactions have landed in the last 24 hours. Start something."
          action={{ href: '/flash-news', label: 'Browse Flash News' }}
        />
      ) : (
        <div className="space-y-16">
          {sections.map((section) => (
            <section key={section.id} aria-labelledby={section.id}>
              <SectionHeader
                title={section.title}
                description={section.description}
                metricLabel={section.metricLabel}
              />
              <div id={section.id}>
                <CardGrid cards={section.cards} />
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
