import type { Metadata } from 'next';
import { CardGrid } from '@/components/cards/CardGrid';
import { CategoryFilter } from '@/components/cards/CategoryFilter';
import { EmptyState } from '@/components/ui/EmptyState';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { EntitySearchField } from '@/components/cards/EntitySearchField';
import { getCurrentUser } from '@/lib/auth/current-user';
import { listEntities, toCards } from '@/lib/services/content';
import { CATEGORIES } from '@/lib/domain/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Entities',
  description: 'Companies, clubs, studios and public bodies with a permanent public record.',
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
    <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <HydrateArtifacts cards={cards} />

      <header className="mb-8 max-w-3xl">
        <p className="label-caps mb-3 text-brand-bright">Entities</p>
        <h1 className="text-balance text-4xl font-black leading-[1.02] tracking-[-0.03em] text-chalk sm:text-5xl">
          Subjects with a permanent record
        </h1>
        <p className="mt-4 text-base leading-relaxed text-haze">
          Every Entity keeps its lifetime totals. One bad week does not erase a good year — and one good week does not
          erase a bad year either.
        </p>
      </header>

      <div className="mb-6">
        <EntitySearchField initialValue={q ?? ''} />
      </div>

      <CategoryFilter categories={[...CATEGORIES]} active={category ?? null} />

      {cards.length === 0 ? (
        <EmptyState
          emoji="🏅"
          title="No Entities match"
          description="Try a different category or clear the search."
          action={{ href: '/entities', label: 'Show all Entities' }}
        />
      ) : (
        <CardGrid cards={cards} priorityCount={3} />
      )}
    </div>
  );
}
