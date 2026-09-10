import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArtifactHeader } from '@/components/artifact/ArtifactHeader';
import { SentimentPanel } from '@/components/artifact/SentimentPanel';
import { StickyReactionTray } from '@/components/artifact/StickyReactionTray';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { CardGrid } from '@/components/cards/CardGrid';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getEntityBySlug, listFlashNews, toCards } from '@/lib/services/content';
import { recentActivity } from '@/lib/services/reactions';
import { formatCount } from '@/lib/domain/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entity = await getEntityBySlug(slug);
  if (!entity) return { title: 'Entity not found' };
  return {
    title: entity.name,
    description: entity.description,
    openGraph: { title: entity.name, description: entity.description, images: entity.imageUrl ? [entity.imageUrl] : [] },
  };
}

export default async function EntityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;

  const entity = await getEntityBySlug(slug);
  if (!entity) notFound();

  const [cards, relatedFlashNews, activity] = await Promise.all([
    toCards({ entities: [entity] }, { viewerId }),
    listFlashNews({ entityId: entity.id, limit: 12 }).then((items) =>
      toCards({ flashNews: items }, { viewerId, withVelocity: true }),
    ),
    recentActivity('entity', entity.id, 8),
  ]);

  const card = cards[0];
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/entities/${entity.slug}`;

  return (
    <>
      <HydrateArtifacts cards={[card, ...relatedFlashNews]} />
      <ArtifactHeader card={card} timeLabel="Updated" shareUrl={shareUrl} />

      <div className="mx-auto w-full max-w-[1400px] px-4 pb-28 sm:px-6 lg:px-10 lg:pb-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
          <div className="order-2 space-y-10 lg:order-1">
            <SentimentPanel card={card} activity={activity} anchorId="reaction-zones" />
          </div>

          <aside className="order-1 space-y-6 lg:order-2 lg:pt-2">
            <section className="glass rounded-[var(--radius-card)] p-5">
              <h2 className="label-caps mb-4 text-haze-dim">Lifetime record</h2>

              <dl className="space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-haze">Rotten Eggs</dt>
                  <dd className="text-lg font-bold tabular text-egg">
                    {formatCount(card.totals.rottenEggTotal)} <span className="emoji text-sm">🥚</span>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-haze">Medals</dt>
                  <dd className="text-lg font-bold tabular text-medal">
                    {formatCount(card.totals.medalTotal)} <span className="emoji text-sm">🏅</span>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-white/8 pt-3">
                  <dt className="text-haze">People frustrated</dt>
                  <dd className="font-semibold tabular text-chalk-dim">
                    {formatCount(card.totals.negativeOpinionTotal)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-haze">People appreciative</dt>
                  <dd className="font-semibold tabular text-chalk-dim">
                    {formatCount(card.totals.positiveOpinionTotal)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-haze">Flash News items</dt>
                  <dd className="font-semibold tabular text-chalk-dim">{relatedFlashNews.length}</dd>
                </div>
              </dl>

              <p className="mt-4 border-t border-white/8 pt-4 text-xs leading-relaxed text-haze-dim">
                {entity.description}
              </p>
            </section>
          </aside>
        </div>

        <section className="mt-16">
          <SectionHeader
            eyebrow="Related"
            title="Related Flash News"
            description={`Everything the crowd has reacted to about ${entity.name}.`}
          />
          {relatedFlashNews.length === 0 ? (
            <EmptyState
              title="No Flash News yet"
              description="Nothing specific has been filed against this Entity. The lifetime counters above are still open."
              action={{ href: '/flash-news', label: 'Browse Flash News' }}
            />
          ) : (
            <CardGrid cards={relatedFlashNews} />
          )}
        </section>
      </div>

      <StickyReactionTray card={card} watchTargetId="reaction-zones" />
    </>
  );
}
