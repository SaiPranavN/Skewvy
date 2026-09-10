import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { ArtifactHeader } from '@/components/artifact/ArtifactHeader';
import { SentimentPanel } from '@/components/artifact/SentimentPanel';
import { StickyReactionTray } from '@/components/artifact/StickyReactionTray';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { CardGrid } from '@/components/cards/CardGrid';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getFlashNewsBySlug, entitiesForFlashNews, listFlashNews, toCards } from '@/lib/services/content';
import { recentActivity } from '@/lib/services/reactions';
import { formatCount } from '@/lib/domain/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await getFlashNewsBySlug(slug);
  if (!item) return { title: 'Flash News not found' };
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

  const [cards, relatedEntities, activity] = await Promise.all([
    toCards({ flashNews: [item] }, { viewerId }),
    entitiesForFlashNews(item.id),
    recentActivity('flash_news', item.id, 8),
  ]);

  const card = cards[0];

  // Other Flash News about the same Entities.
  const primaryEntity = relatedEntities[0] ?? null;
  const moreFromEntity = primaryEntity
    ? await listFlashNews({ entityId: primaryEntity.id, limit: 4 }).then((items) =>
        toCards({ flashNews: items.filter((other) => other.id !== item.id).slice(0, 3) }, { viewerId }),
      )
    : [];

  const entityCards = primaryEntity ? await toCards({ entities: [primaryEntity] }, { viewerId }) : [];
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/flash-news/${item.slug}`;

  return (
    <>
      <HydrateArtifacts cards={[card, ...moreFromEntity, ...entityCards]} />
      <ArtifactHeader card={card} timeLabel="Published" shareUrl={shareUrl} />

      <div className="mx-auto w-full max-w-[1400px] px-4 pb-28 sm:px-6 lg:px-10 lg:pb-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
          <div className="order-2 space-y-10 lg:order-1">
            <SentimentPanel card={card} activity={activity} anchorId="reaction-zones" />

            {item.body && (
              <section aria-labelledby="context-heading" className="glass rounded-[var(--radius-card)] p-6">
                <h2 id="context-heading" className="text-lg font-bold text-chalk">
                  What happened
                </h2>
                <p className="mt-3 whitespace-pre-line text-[0.9375rem] leading-relaxed text-chalk-dim">{item.body}</p>
                {item.sourceLabel && (
                  <p className="mt-4 border-t border-white/8 pt-4 text-xs text-haze-dim">
                    Source: {item.sourceUrl ? (
                      <a href={item.sourceUrl} rel="noopener noreferrer nofollow" target="_blank" className="underline">
                        {item.sourceLabel}
                      </a>
                    ) : (
                      item.sourceLabel
                    )}{' '}
                    · This is fictional sample content.
                  </p>
                )}
              </section>
            )}
          </div>

          <aside className="order-1 space-y-6 lg:order-2 lg:pt-2">
            {relatedEntities.length > 0 ? (
              <section aria-labelledby="about-entity" className="glass rounded-[var(--radius-card)] p-5">
                <h2 id="about-entity" className="label-caps mb-4 text-haze-dim">
                  About the related {relatedEntities.length > 1 ? 'Entities' : 'Entity'}
                </h2>

                <ul className="space-y-4">
                  {relatedEntities.map((entity) => (
                    <li key={entity.id}>
                      <Link href={`/entities/${entity.slug}`} className="group flex gap-3">
                        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10">
                          {entity.imageUrl && (
                            <Image src={entity.imageUrl} alt="" fill sizes="56px" className="cover-image" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-chalk group-hover:underline">
                            {entity.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-haze-dim">{entity.category}</span>
                          <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-haze">
                            {entity.description}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>

                {entityCards[0] && (
                  <p className="mt-4 border-t border-white/8 pt-4 text-xs text-haze">
                    Lifetime:{' '}
                    <span className="font-semibold text-egg">
                      {formatCount(entityCards[0].totals.rottenEggTotal)} 🥚
                    </span>{' '}
                    ·{' '}
                    <span className="font-semibold text-medal">
                      {formatCount(entityCards[0].totals.medalTotal)} 🏅
                    </span>
                  </p>
                )}
              </section>
            ) : (
              <section className="glass rounded-[var(--radius-card)] p-5">
                <h2 className="label-caps mb-2 text-haze-dim">No related Entity</h2>
                <p className="text-sm leading-relaxed text-haze">
                  This one stands on its own — no company, club or organisation attached.
                </p>
              </section>
            )}
          </aside>
        </div>

        {moreFromEntity.length > 0 && primaryEntity && (
          <section className="mt-16">
            <SectionHeader
              eyebrow="Same subject"
              title={`More Flash News about ${primaryEntity.name}`}
              action={{ href: `/entities/${primaryEntity.slug}`, label: 'Entity page' }}
            />
            <CardGrid cards={moreFromEntity} />
          </section>
        )}
      </div>

      <StickyReactionTray card={card} watchTargetId="reaction-zones" />
    </>
  );
}
