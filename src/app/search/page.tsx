import type { Metadata } from 'next';
import { CardGrid } from '@/components/cards/CardGrid';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { SearchField } from '@/components/cards/SearchField';
import { getCurrentUser } from '@/lib/auth/current-user';
import { searchArtifacts } from '@/lib/services/search';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Find an Entity or a Flash News item.',
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const user = await getCurrentUser();
  const results = await searchArtifacts(q ?? '', user?.id ?? null);
  const allCards = [...results.entities, ...results.flashNews];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <HydrateArtifacts cards={allCards} />

      <header className="mb-8 max-w-3xl">
        <p className="label-caps mb-3 text-brand-bright">Search</p>
        <h1 className="text-balance text-4xl font-black leading-[1.02] tracking-[-0.03em] text-chalk sm:text-5xl">
          Find something worth reacting to
        </h1>
      </header>

      <div className="mb-10">
        <SearchField initialValue={q ?? ''} />
      </div>

      {!results.query ? (
        <EmptyState
          emoji="🔎"
          title="Type a name or a headline"
          description="Search across every Entity and Flash News item on Skewvy."
          action={{ href: '/trending', label: 'Or see what is trending' }}
        />
      ) : results.total === 0 ? (
        <EmptyState
          title={`Nothing matches “${results.query}”`}
          description="Try a shorter term, or browse the full Flash News feed."
          action={{ href: '/flash-news', label: 'Browse Flash News' }}
        />
      ) : (
        <div className="space-y-14">
          {results.flashNews.length > 0 && (
            <section aria-labelledby="search-flash-news">
              <SectionHeader
                title="Flash News"
                description={`${results.flashNews.length} ${results.flashNews.length === 1 ? 'match' : 'matches'}`}
              />
              <div id="search-flash-news">
                <CardGrid cards={results.flashNews} />
              </div>
            </section>
          )}

          {results.entities.length > 0 && (
            <section aria-labelledby="search-entities">
              <SectionHeader
                title="Entities"
                description={`${results.entities.length} ${results.entities.length === 1 ? 'match' : 'matches'}`}
              />
              <div id="search-entities">
                <CardGrid cards={results.entities} />
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
