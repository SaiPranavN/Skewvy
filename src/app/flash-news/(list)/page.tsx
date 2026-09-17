import type { Metadata } from 'next';
import { CardGrid } from '@/components/cards/CardGrid';
import { LeadStory } from '@/components/cards/LeadStory';
import { FilterBar } from '@/components/cards/FilterBar';
import { PageIntro } from '@/components/ui/PageIntro';
import { EmptyState } from '@/components/ui/EmptyState';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { getCurrentUser } from '@/lib/auth/current-user';
import { listFlashNews, toCards } from '@/lib/services/content';
import { FLASH_NEWS_CATEGORIES } from '@/lib/domain/types';
import { formatCount } from '@/lib/domain/format';
import type { ArtifactCard } from '@/lib/domain/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Flash News',
  description: 'Specific events, decisions and announcements the public is reacting to.',
};

const SORTS = [
  { label: 'Newest', value: null },
  { label: 'Most eggs', value: 'eggs' },
  { label: 'Most medals', value: 'medals' },
];

/** Ordering happens here rather than in SQL: the listing is already capped. */
function sortCards(cards: ArtifactCard[], sort: string | undefined): ArtifactCard[] {
  const ranked = [...cards];
  if (sort === 'eggs') ranked.sort((a, b) => b.totals.rottenEggTotal - a.totals.rottenEggTotal);
  else if (sort === 'medals') ranked.sort((a, b) => b.totals.medalTotal - a.totals.medalTotal);
  return ranked;
}

export default async function FlashNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string }>;
}) {
  const { category, q, sort } = await searchParams;
  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;

  const items = await listFlashNews({ category: category ?? null, search: q ?? null, limit: 40 });
  const cards = sortCards(await toCards({ flashNews: items }, { viewerId, withVelocity: true }), sort);

  /*
   * The lead is only pulled out of the grid on the unfiltered, default view.
   * Once someone has filtered or re-sorted, promoting one item above the rest
   * would contradict the ordering they just asked for.
   */
  const isDefaultView = !category && !q && !sort;
  const lead = isDefaultView ? (cards[0] ?? null) : null;
  const rest = lead ? cards.slice(1) : cards;

  const sortLabel = SORTS.find((option) => (option.value ?? undefined) === sort)?.label ?? 'Newest';
  const categoryCount = new Set(cards.map((card) => card.category)).size;

  return (
    <div className="page-enter">
      <HydrateArtifacts cards={cards} />

      <section className="rail">
        <PageIntro
          eyebrow="Flash News"
          title="Things that just happened, and what it cost them"
          description="Specific events, decisions and releases. Every total below counts taps, not people."
        />
      </section>

      {lead && (
        <section className="rail mt-[clamp(30px,4vw,60px)]">
          <LeadStory card={lead} entityName={lead.relatedEntities?.[0]?.name ?? null} />
        </section>
      )}

      <section className="rail mt-[clamp(34px,4.4vw,68px)]">
        <FilterBar
          basePath="/flash-news"
          categories={FLASH_NEWS_CATEGORIES}
          activeCategory={category ?? null}
          sorts={SORTS}
          activeSort={sort ?? null}
          searchPlaceholder="Search headlines"
          searchLabel="Search Flash News"
          searchValue={q ?? ''}
        />

        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-3 text-xs">
          <p className="font-semibold text-secondary">
            <span className="numeric">{formatCount(cards.length)}</span> {cards.length === 1 ? 'story' : 'stories'}
            {categoryCount > 0 && ` across ${categoryCount} ${categoryCount === 1 ? 'category' : 'categories'}`} ·
            sorted by {sortLabel.toLowerCase()}
          </p>
          <p className="eyebrow">Totals count taps</p>
        </div>
      </section>

      <section className="rail mt-5 pb-[clamp(30px,4vw,64px)]">
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
          <CardGrid cards={rest} columns={4} priorityCount={4} />
        )}
      </section>
    </div>
  );
}
