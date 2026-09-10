import type { Metadata } from 'next';
import { CardGrid } from '@/components/cards/CardGrid';
import { CategoryFilter } from '@/components/cards/CategoryFilter';
import { EmptyState } from '@/components/ui/EmptyState';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { getCurrentUser } from '@/lib/auth/current-user';
import { listFlashNews, toCards } from '@/lib/services/content';
import { CATEGORIES } from '@/lib/domain/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Flash News',
  description: 'Every headline gets the crowd it deserves. React to what just happened.',
};

export default async function FlashNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;

  const items = await listFlashNews({ category: category ?? null, limit: 40 });
  const cards = await toCards({ flashNews: items }, { viewerId, withVelocity: true });

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <HydrateArtifacts cards={cards} />

      <header className="mb-8 max-w-3xl">
        <p className="label-caps mb-3 text-brand-bright">Flash News</p>
        <h1 className="text-balance text-4xl font-black leading-[1.02] tracking-[-0.03em] text-chalk sm:text-5xl">
          The internet has opinions
        </h1>
        <p className="mt-4 text-base leading-relaxed text-haze">
          Specific things that happened — announcements, decisions, comebacks, releases. Pick a side and make the
          counter sweat.
        </p>
      </header>

      <CategoryFilter categories={[...CATEGORIES]} active={category ?? null} />

      {cards.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description={
            category
              ? `No published Flash News in ${category}. Try another filter, or look at everything.`
              : 'No published Flash News. Seed the demo world or publish an item from the admin area.'
          }
          action={{ href: '/flash-news', label: 'Show everything' }}
        />
      ) : (
        <CardGrid cards={cards} priorityCount={3} />
      )}
    </div>
  );
}
