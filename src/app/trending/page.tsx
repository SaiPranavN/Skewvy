import type { Metadata } from 'next';
import { RankedRow } from '@/components/cards/RankedRow';
import { CardGrid } from '@/components/cards/CardGrid';
import { FilterTabs } from '@/components/cards/FilterTabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { getCurrentUser } from '@/lib/auth/current-user';
import { rankedIndex, trendingTab, newlyAdded, TRENDING_TABS } from '@/lib/services/trending';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trending',
  description: 'Ranked by reactions received in the last 24 hours, not by lifetime totals.',
};

export default async function TrendingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;

  const active = trendingTab(tab);
  const [ranked, fresh] = await Promise.all([
    rankedIndex(active.id, { viewerId, limit: 12 }),
    newlyAdded({ viewerId, limit: 3 }),
  ]);

  const metric = active.id === 'rotten_egg' ? 'rotten_egg' : active.id === 'medal' ? 'medal' : 'activity';
  const windowLabel = active.id === 'shifting' ? 'pt swing' : 'today';

  return (
    <div className="page-enter mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <HydrateArtifacts cards={[...ranked.map((item) => item.card), ...fresh]} />

      <PageHeader
        title="Trending"
        description="Ranked by how fast reactions are arriving, not by who has been collecting them the longest."
      >
        <FilterTabs
          label="Ranking method"
          param="tab"
          active={active.id === 'activity' ? null : active.id}
          options={[
            { label: TRENDING_TABS[0].label, value: null },
            ...TRENDING_TABS.slice(1).map((item) => ({ label: item.label, value: item.id })),
          ]}
        />
      </PageHeader>

      <section aria-labelledby="ranked-heading">
        <SectionHeader title={active.title} metricLabel={active.metricLabel} className="mb-3" />

        {ranked.length === 0 ? (
          <EmptyState
            title="No reactions in the last 24 hours"
            description="Nothing has been ranked for this window yet."
            action={{ href: '/flash-news', label: 'Browse Flash News' }}
          />
        ) : (
          <ul id="ranked-heading" className="border-t border-[var(--border-subtle)]">
            {ranked.map((item, index) => (
              <RankedRow
                key={`${item.card.type}:${item.card.id}`}
                item={item}
                rank={index + 1}
                metric={metric}
                windowLabel={windowLabel}
              />
            ))}
          </ul>
        )}
      </section>

      {fresh.length > 0 && (
        <section className="mt-14">
          <SectionHeader
            title="Recently added"
            description="Newly published Flash News. Not ranked — the counters are still filling."
          />
          <CardGrid cards={fresh} />
        </section>
      )}
    </div>
  );
}
