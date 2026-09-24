import type { Metadata } from 'next';
import { RankedRow } from '@/components/cards/RankedRow';
import { CardGrid } from '@/components/cards/CardGrid';
import { FilterBar } from '@/components/cards/FilterBar';
import { PageIntro } from '@/components/ui/PageIntro';
import { EmptyState } from '@/components/ui/EmptyState';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { getCurrentUser } from '@/lib/auth/current-user';
import { rankedIndex, trendingTab, newlyAdded, TRENDING_TABS } from '@/lib/services/trending';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Leaderboards',
  description: 'Ranked by reactions received in the last 24 hours, not by lifetime totals.',
};

export default async function TrendingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;

  const active = trendingTab(tab);
  const [ranked, fresh] = await Promise.all([
    rankedIndex(active.id, { viewerId, limit: 12 }),
    newlyAdded({ viewerId, limit: 4 }),
  ]);

  const metric = active.id === 'rotten_egg' ? 'rotten_egg' : active.id === 'medal' ? 'medal' : 'activity';
  const windowLabel = active.id === 'shifting' ? 'pt swing' : 'today';

  return (
    <div className="page-enter">
      <HydrateArtifacts cards={[...ranked.map((item) => item.card), ...fresh]} />

      <section className="rail">
        <PageIntro
          eyebrow="Leaderboards"
          title="Who is collecting it fastest"
          description="Ranked by how quickly reactions are arriving, not by who has been collecting them the longest."
        />

        <div className="mt-[clamp(26px,3.4vw,54px)]">
          <FilterBar
            basePath="/trending"
            categoryParam="tab"
            allLabel={TRENDING_TABS[0].label}
            categories={TRENDING_TABS.slice(1).map((item) => ({ label: item.label, value: item.id }))}
            activeCategory={active.id === 'activity' ? null : active.id}
          />
        </div>
      </section>

      <section aria-labelledby="ranked-heading" className="rail mt-[clamp(26px,3.2vw,48px)]">
        <div className="mb-[clamp(14px,1.8vw,24px)] flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--border-default)] pb-4">
          <h2 id="ranked-heading" className="display-sm m-0 text-[clamp(22px,2.6vw,36px)]">
            {active.title}
          </h2>
          <p className="eyebrow">{active.metricLabel}</p>
        </div>

        {ranked.length === 0 ? (
          <EmptyState
            title="No reactions in the last 24 hours"
            description="Nothing has been ranked for this window yet."
            action={{ href: '/flash-news', label: 'Browse Stories' }}
          />
        ) : (
          <ul>
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
        <section className="rail mt-[clamp(34px,4.4vw,68px)] pb-[clamp(30px,4vw,64px)]">
          <div className="mb-[clamp(16px,2vw,28px)]">
            <h2 className="display m-0 text-[clamp(26px,3.4vw,48px)]">Recently added</h2>
            <p className="mt-3 text-[15px] leading-[1.5] text-secondary">
              Newly published Stories. Not ranked — the counters are still filling.
            </p>
          </div>
          <CardGrid cards={fresh} columns={4} />
        </section>
      )}
    </div>
  );
}
