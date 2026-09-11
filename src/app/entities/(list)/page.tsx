import type { Metadata } from 'next';
import { CardGrid } from '@/components/cards/CardGrid';
import { FilterTabs } from '@/components/cards/FilterTabs';
import { SearchField } from '@/components/cards/SearchField';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { getCurrentUser } from '@/lib/auth/current-user';
import { listEntities, toCards } from '@/lib/services/content';
import { CATEGORIES } from '@/lib/domain/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Entities',
  description: 'Companies, clubs, studios and public bodies with a lifetime sentiment record.',
};

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;

  const entities = await listEntities({ category: category ?? null, search: q ?? null, limit: 60 });
  const cards = await toCards({ entities }, { viewerId, withVelocity: true });

  return (
    <div className="page-enter mx-auto w-full max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <HydrateArtifacts cards={cards} />

      <PageHeader
        title="Entities"
        description="A subject that accumulates sentiment over time. Lifetime totals stay on the record."
      >
        <div className="space-y-5">
          <SearchField
            basePath="/entities"
            initialValue={q ?? ''}
            label="Search Entities"
            placeholder="Search by name"
          />
          <FilterTabs
            label="Filter by category"
            active={category ?? null}
            options={[{ label: 'All', value: null }, ...CATEGORIES.map((value) => ({ label: value, value }))]}
          />
        </div>
      </PageHeader>

      {cards.length === 0 ? (
        <EmptyState
          title="No Entities match"
          description="Try a different category, or clear the search."
          action={{ href: '/entities', label: 'Show all Entities' }}
        />
      ) : (
        <CardGrid cards={cards} priorityCount={3} />
      )}
    </div>
  );
}
