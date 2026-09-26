import type { Metadata } from 'next';
import { CardGrid } from '@/components/cards/CardGrid';
import { FilterBar } from '@/components/cards/FilterBar';
import { PageIntro } from '@/components/ui/PageIntro';
import { EmptyState } from '@/components/ui/EmptyState';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { getCurrentUser } from '@/lib/auth/current-user';
import { searchArtifacts } from '@/lib/services/search';
import { formatCount } from '@/lib/domain/format';

export const dynamic = 'force-dynamic';

// Result pages are thin and endless; crawl the links, do not index the page.
export const metadata: Metadata = {
  title: 'Search',
  description: 'Find a Profile or a Story.',
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const user = await getCurrentUser();
  const results = await searchArtifacts(q ?? '', user?.id ?? null);

  return (
    <div className="page-enter">
      <HydrateArtifacts cards={[...results.entities, ...results.flashNews]} />

      <section className="rail">
        <PageIntro
          eyebrow="Search"
          title={results.query ? `Results for “${results.query}”` : 'Find something to react to'}
          description="Across every Profile and Story on Skewvy."
        />

        <div className="mt-[clamp(26px,3.4vw,54px)]">
          <FilterBar
            basePath="/search"
            categories={[]}
            activeCategory={null}
            allLabel="Everything"
            searchPlaceholder="Search profiles and headlines"
            searchLabel="Search Skewvy"
            searchValue={q ?? ''}
          />
        </div>
      </section>

      <section className="rail mt-[clamp(20px,2.6vw,38px)] pb-[clamp(30px,4vw,64px)]">
        {!results.query ? (
          <EmptyState
            title="Type a name or a headline"
            description="Results cover both Profiles and Stories."
            action={{ href: '/trending', label: 'Or see what is most active' }}
          />
        ) : results.total === 0 ? (
          <EmptyState
            title={`Nothing matches “${results.query}”`}
            description="Try a shorter term, or browse the full Stories feed."
            action={{ href: '/flash-news', label: 'Browse Stories' }}
          />
        ) : (
          <div className="flex flex-col gap-[clamp(32px,4vw,60px)]">
            {results.flashNews.length > 0 && (
              <section aria-labelledby="search-flash-news">
                <ResultHeading id="search-flash-news" title="Stories" count={results.flashNews.length} />
                <CardGrid cards={results.flashNews} columns={4} />
              </section>
            )}

            {results.entities.length > 0 && (
              <section aria-labelledby="search-entities">
                <ResultHeading id="search-entities" title="Profiles" count={results.entities.length} />
                <CardGrid cards={results.entities} columns={4} />
              </section>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ResultHeading({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <div className="mb-[clamp(14px,1.8vw,24px)] flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--border-default)] pb-4">
      <h2 id={id} className="display-sm m-0 text-[clamp(22px,2.6vw,36px)]">
        {title}
      </h2>
      <p className="eyebrow">
        {formatCount(count)} {count === 1 ? 'result' : 'results'}
      </p>
    </div>
  );
}
