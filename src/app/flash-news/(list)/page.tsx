import type { Metadata } from 'next';
import { CardGrid } from '@/components/cards/CardGrid';
import { FilterTabs } from '@/components/cards/FilterTabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { getCurrentUser } from '@/lib/auth/current-user';
import { listFlashNews, toCards } from '@/lib/services/content';
import { FLASH_NEWS_CATEGORIES } from '@/lib/domain/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Flash News',
  description: 'Specific events, decisions and announcements the public is reacting to.',
};

export default async function FlashNewsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;

  const items = await listFlashNews({ category: category ?? null, limit: 40 });
  const cards = await toCards({ flashNews: items }, { viewerId, withVelocity: true });

  return (
    <div className="page-enter mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <HydrateArtifacts cards={cards} />

      <PageHeader
        title="Flash News"
        description="A specific event, decision or announcement. Each one carries its own reaction totals."
      >
        <FilterTabs
          label="Filter by category"
          active={category ?? null}
          options={[{ label: 'All', value: null }, ...FLASH_NEWS_CATEGORIES.map((value) => ({ label: value, value }))]}
        />
      </PageHeader>

      {cards.length === 0 ? (
        <EmptyState
          title="Nothing published here yet"
          description={
            category
              ? `No published Flash News in ${category}.`
              : 'No published Flash News yet. Publish an item from the admin area and it appears here.'
          }
          action={{ href: '/flash-news', label: 'Show everything' }}
        />
      ) : (
        <CardGrid cards={cards} priorityCount={3} />
      )}
    </div>
  );
}
