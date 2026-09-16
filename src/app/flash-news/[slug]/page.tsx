import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArtifactHeader } from '@/components/artifact/ArtifactHeader';
import { SentimentPanel } from '@/components/artifact/SentimentPanel';
import { StickyReactionTray } from '@/components/artifact/StickyReactionTray';
import { ReactionTrendChart } from '@/components/artifact/ReactionTrendChart';
import { CommentSection } from '@/components/artifact/CommentSection';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { CardGrid } from '@/components/cards/CardGrid';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Media, initialsFor } from '@/components/ui/Media';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getFlashNewsBySlug, entitiesForFlashNews, listFlashNews, toCards } from '@/lib/services/content';
import { recentActivity } from '@/lib/services/reactions';
import { reactionTrend } from '@/lib/services/timeline';
import { listComments } from '@/lib/services/comments';
import { formatCount } from '@/lib/domain/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await getFlashNewsBySlug(slug);
  if (!item) return { title: 'Not found' };
  return {
    title: item.headline,
    description: item.summary,
    openGraph: { title: item.headline, description: item.summary, images: item.imageUrl ? [item.imageUrl] : [] },
  };
}

export default async function FlashNewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;

  const item = await getFlashNewsBySlug(slug);
  if (!item) notFound();

  const [cards, relatedEntities, activity, trend, comments] = await Promise.all([
    toCards({ flashNews: [item] }, { viewerId }),
    entitiesForFlashNews(item.id),
    recentActivity('flash_news', item.id, 6),
    reactionTrend('flash_news', item.id),
    listComments('flash_news', item.id, { viewerId, viewerIsAdmin: user?.isAdmin ?? false }),
  ]);

  const card = cards[0];
  const primaryEntity = relatedEntities[0] ?? null;

  const moreFromEntity = primaryEntity
    ? await listFlashNews({ entityId: primaryEntity.id, limit: 4 }).then((items) =>
        toCards({ flashNews: items.filter((other) => other.id !== item.id).slice(0, 3) }, { viewerId }),
      )
    : [];

  const entityCards = primaryEntity ? await toCards({ entities: [primaryEntity] }, { viewerId }) : [];
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/flash-news/${item.slug}`;

  return (
    <div className="page-enter">
      <HydrateArtifacts cards={[card, ...moreFromEntity, ...entityCards]} />

      <div className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-12">
          {/* Factual context */}
          <div className="min-w-0 space-y-8">
            <ArtifactHeader
              card={card}
              timeLabel="Published"
              shareUrl={shareUrl}
              sourceLabel={item.sourceLabel}
              sourceUrl={item.sourceUrl}
            />

            {item.body && (
              <section aria-labelledby="context-heading" className="pt-1">
                <h2 id="context-heading" className="text-sm font-medium text-primary">
                  What happened
                </h2>
                <p className="mt-3 max-w-2xl whitespace-pre-line text-[0.9375rem] leading-[1.7] text-secondary">
                  {item.body}
                </p>
              </section>
            )}

            {/* The space the picture used to take, now carrying the history. */}
            <ReactionTrendChart trend={trend} artifactType="flash_news" artifactId={item.id} totals={card.totals} />

            {relatedEntities.length > 0 && (
              <section aria-labelledby="entity-heading" className="divider pt-6">
                <h2 id="entity-heading" className="text-sm font-medium text-primary">
                  {relatedEntities.length > 1 ? 'Related entities' : 'Related entity'}
                </h2>

                <ul className="mt-4 space-y-4">
                  {relatedEntities.map((entity) => {
                    const entityCard = entityCards.find((candidate) => candidate.id === entity.id);
                    return (
                      <li key={entity.id}>
                        <Link href={`/entities/${entity.slug}`} className="media-hover group flex gap-3.5">
                          <Media
                            src={entity.imageUrl}
                            alt=""
                            fallbackLabel={initialsFor(entity.name)}
                            fallbackKind="initials"
                            sizes="56px"
                            className="aspect-square w-14 shrink-0 rounded-md border border-[var(--border-subtle)]"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-primary">
                              {entity.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-tertiary">{entity.category}</span>
                            <span className="mt-1.5 line-clamp-2 block text-sm leading-relaxed text-secondary">
                              {entity.description}
                            </span>
                            {entityCard && (
                              <span className="mt-1.5 block text-xs text-tertiary">
                                Lifetime:{' '}
                                <span className="numeric text-egg">
                                  {formatCount(entityCard.totals.rottenEggTotal)}
                                </span>{' '}
                                <span className="emoji">🥚</span> ·{' '}
                                <span className="numeric text-medal">
                                  {formatCount(entityCard.totals.medalTotal)}
                                </span>{' '}
                                <span className="emoji">🏅</span>
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <CommentSection
              artifactType="flash_news"
              artifactId={item.id}
              initial={comments}
              viewerName={user?.displayName ?? null}
            />
          </div>

          {/* Public reaction */}
          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <SentimentPanel card={card} activity={activity} anchorId="reaction-controls" />
          </div>
        </div>

        {moreFromEntity.length > 0 && primaryEntity && (
          <section className="mt-14">
            <SectionHeader
              title={`More about ${primaryEntity.name}`}
              action={{ href: `/entities/${primaryEntity.slug}`, label: 'Entity page' }}
            />
            <CardGrid cards={moreFromEntity} />
          </section>
        )}
      </div>

      <StickyReactionTray card={card} watchTargetId="reaction-controls" />
    </div>
  );
}
