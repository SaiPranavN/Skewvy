import type { Metadata } from 'next';
import { CardGrid } from '@/components/cards/CardGrid';
import { FilterBar } from '@/components/cards/FilterBar';
import { PageIntro } from '@/components/ui/PageIntro';
import { EmptyState } from '@/components/ui/EmptyState';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { getCurrentUser } from '@/lib/auth/current-user';
import { listEntities, toCards } from '@/lib/services/content';
import { ENTITY_CATEGORIES } from '@/lib/domain/types';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactCard } from '@/lib/domain/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: '/entities' },
  title: 'Profiles',
  description: 'Companies, clubs, studios and public bodies with a lifetime sentiment record.',
};

const SORTS = [
  { label: 'Most active', value: null },
  { label: 'Most eggs', value: 'eggs' },
  { label: 'Most medals', value: 'medals' },
];

/** Ordering happens here rather than in SQL: the listing is already capped. */
function sortCards(cards: ArtifactCard[], sort: string | undefined): ArtifactCard[] {
  const ranked = [...cards];
  if (sort === 'eggs') ranked.sort((a, b) => b.totals.rottenEggTotal - a.totals.rottenEggTotal);
  else if (sort === 'medals') ranked.sort((a, b) => b.totals.medalTotal - a.totals.medalTotal);
  else
    ranked.sort(
      (a, b) =>
        (b.recentRottenEggs ?? 0) + (b.recentMedals ?? 0) - ((a.recentRottenEggs ?? 0) + (a.recentMedals ?? 0)),
    );
  return ranked;
}

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string }>;
}) {
  const { category, q, sort } = await searchParams;
  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;

  const entities = await listEntities({ category: category ?? null, search: q ?? null, limit: 60 });
  const cards = sortCards(await toCards({ entities }, { viewerId, withVelocity: true }), sort);

  const sortLabel = SORTS.find((option) => (option.value ?? undefined) === sort)?.label ?? 'Most active';

  return (
    <div className="page-enter">
      <HydrateArtifacts cards={cards} />

      <section className="rail">
        <PageIntro
          eyebrow="Profiles"
          title="The subjects with a permanent record"
          description="Organizations, products, teams and public initiatives. Totals here are lifetime, across every Story — not a single event."
        />

        <div className="mt-[clamp(26px,3.4vw,54px)]">
          <FilterBar
            basePath="/entities"
            categories={ENTITY_CATEGORIES}
            activeCategory={category ?? null}
            sorts={SORTS}
            activeSort={sort ?? null}
            searchPlaceholder="Search profiles"
            searchLabel="Search Profiles"
            searchValue={q ?? ''}
          />

          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-3 text-xs">
            <p className="font-semibold text-secondary">
              <span className="numeric">{formatCount(cards.length)}</span>{' '}
              {cards.length === 1 ? 'profile' : 'profiles'} · sorted by {sortLabel.toLowerCase()}
            </p>
            <p className="eyebrow">Lifetime totals</p>
          </div>
        </div>
      </section>

      <section className="rail mt-5 pb-[clamp(30px,4vw,64px)]">
        {cards.length === 0 ? (
          <EmptyState
            title="No Profiles match"
            description="Try a different category, or clear the search."
            action={{ href: '/entities', label: 'Show all Profiles' }}
          />
        ) : (
          <CardGrid cards={cards} columns={4} priorityCount={4} />
        )}
      </section>
    </div>
  );
}
