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
import { recentVelocity } from '@/lib/services/totals';
import { formatCount } from '@/lib/domain/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entity = await getEntityBySlug(slug);
  if (!entity) return { title: 'Not found' };
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

  const [cards, relatedFlashNews, activity, velocity] = await Promise.all([
    toCards({ entities: [entity] }, { viewerId }),
    listFlashNews({ entityId: entity.id, limit: 12 }).then((items) =>
      toCards({ flashNews: items }, { viewerId, withVelocity: true }),
    ),
    recentActivity('entity', entity.id, 6),
    recentVelocity(24 * 60),
  ]);

  const card = cards[0];
  const recent = velocity.get(`entity:${entity.id}`) ?? { rottenEggs: 0, medals: 0 };
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/entities/${entity.slug}`;

  return (
    <div className="page-enter">
      <HydrateArtifacts cards={[card, ...relatedFlashNews]} />

      <div className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-12">
          <div className="space-y-8">
            <ArtifactHeader card={card} timeLabel="Updated" shareUrl={shareUrl} />

            {/*
             * Lifetime and recent sentiment are labelled separately, and neither
             * is mixed with the totals of the Flash News items below — an
             * Entity's counters are its own.
             */}
            <section aria-labelledby="record-heading" className="divider pt-6">
              <h2 id="record-heading" className="text-sm font-medium text-primary">
                Sentiment record
              </h2>

              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="eyebrow">Lifetime</p>
                  <dl className="mt-2.5 space-y-2 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-secondary">
                        <span className="emoji mr-1.5 text-xs">🥚</span>Rotten Eggs
                      </dt>
                      <dd className="numeric-lg text-base font-semibold text-egg">
                        {formatCount(card.totals.rottenEggTotal)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-secondary">
                        <span className="emoji mr-1.5 text-xs">🏅</span>Medals
                      </dt>
                      <dd className="numeric-lg text-base font-semibold text-medal">
                        {formatCount(card.totals.medalTotal)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <p className="eyebrow">Last 24 hours</p>
                  <dl className="mt-2.5 space-y-2 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-secondary">
                        <span className="emoji mr-1.5 text-xs">🥚</span>Rotten Eggs
                      </dt>
                      <dd className="numeric text-base font-medium text-primary">
                        {recent.rottenEggs > 0 ? `+${formatCount(recent.rottenEggs)}` : '—'}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-secondary">
                        <span className="emoji mr-1.5 text-xs">🏅</span>Medals
                      </dt>
                      <dd className="numeric text-base font-medium text-primary">
                        {recent.medals > 0 ? `+${formatCount(recent.medals)}` : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-tertiary">
                These totals belong to the Entity itself. Reactions to individual Flash News items are counted
                separately on those pages.
              </p>
            </section>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <SentimentPanel card={card} activity={activity} anchorId="reaction-controls" />
          </div>
        </div>

        <section className="mt-14">
          <SectionHeader
            title="Related Flash News"
            description={`Specific events involving ${entity.name}, each with its own reaction totals.`}
          />
          {relatedFlashNews.length === 0 ? (
            <EmptyState
              title="No Flash News yet"
              description="Nothing specific has been filed against this Entity. Its lifetime counters above remain open."
              action={{ href: '/flash-news', label: 'Browse Flash News' }}
            />
          ) : (
            <CardGrid cards={relatedFlashNews} />
          )}
        </section>
      </div>

      <StickyReactionTray card={card} watchTargetId="reaction-controls" />
    </div>
  );
}
