import type { Metadata } from 'next';
import { CardGrid } from '@/components/cards/CardGrid';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { SearchField } from '@/components/cards/SearchField';
import { getCurrentUser } from '@/lib/auth/current-user';
import { searchArtifacts } from '@/lib/services/search';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Search', description: 'Find an Entity or a Flash News item.' };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const user = await getCurrentUser();
  const results = await searchArtifacts(q ?? '', user?.id ?? null);

  return (
    <div className="page-enter mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <HydrateArtifacts cards={[...results.entities, ...results.flashNews]} />

      <PageHeader title="Search" description="Across every Entity and Flash News item on Skewvy.">
        <SearchField
          basePath="/search"
          initialValue={q ?? ''}
          label="Search Skewvy"
          placeholder="Search Entities and Flash News"
          autoFocus
        />
      </PageHeader>

      {!results.query ? (
        <EmptyState
          title="Type a name or a headline"
          description="Results cover both Entities and Flash News."
          action={{ href: '/trending', label: 'Or see what is most active' }}
        />
      ) : results.total === 0 ? (
        <EmptyState
          title={`Nothing matches “${results.query}”`}
          description="Try a shorter term, or browse the full Flash News feed."
          action={{ href: '/flash-news', label: 'Browse Flash News' }}
        />
      ) : (
        <div className="space-y-12">
          {results.flashNews.length > 0 && (
            <section aria-labelledby="search-flash-news">
              <SectionHeader
                title="Flash News"
                description={`${results.flashNews.length} ${results.flashNews.length === 1 ? 'result' : 'results'}`}
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
                description={`${results.entities.length} ${results.entities.length === 1 ? 'result' : 'results'}`}
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
