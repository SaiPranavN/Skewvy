import { cache, Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { OpinionFlow } from '@/components/artifact/OpinionFlow';
import { RelatedEntityAside } from '@/components/artifact/RelatedEntityAside';
import { StickyReactionTray } from '@/components/artifact/StickyReactionTray';
import { DeferredAnalytics, DeferredComments, SectionSkeleton } from '@/components/artifact/DeferredSections';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { CardGrid } from '@/components/cards/CardGrid';
import { ShareReceipt } from '@/components/share/ShareReceipt';
import { LocalDateTime } from '@/components/ui/TimeAgo';
import { DetailsList } from '@/components/artifact/DetailsList';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getFlashNewsBySlug, entitiesForFlashNews, listFlashNews, toCards } from '@/lib/services/content';

export const dynamic = 'force-dynamic';

/** Metadata and the page both need the story; this fetches it once per request. */
const loadStory = cache((slug: string) => getFlashNewsBySlug(slug));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await loadStory(slug);
  if (!item) return { title: 'Not found' };
  return {
    title: item.headline,
    description: item.summary,
    openGraph: {
      title: item.headline,
      description: item.summary,
      images: item.imageUrl ? [item.imageUrl] : [],
    },
  };
}

export default async function FlashNewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [user, item] = await Promise.all([getCurrentUser(), loadStory(slug)]);
  const viewerId = user?.id ?? null;
  if (!item) notFound();

  const [cards, relatedEntities] = await Promise.all([
    toCards({ flashNews: [item] }, { viewerId }),
    entitiesForFlashNews(item.id),
  ]);

  const card = cards[0];
  const primaryEntity = relatedEntities[0] ?? null;

  // The two lookups that hang off the related profile run side by side.
  const [moreFromEntity, entityCards] = primaryEntity
    ? await Promise.all([
        listFlashNews({ entityId: primaryEntity.id, limit: 4 }).then((items) =>
          toCards({ flashNews: items.filter((other) => other.id !== item.id).slice(0, 3) }, { viewerId }),
        ),
        toCards({ entities: [primaryEntity] }, { viewerId }),
      ])
    : [[], []];

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/flash-news/${item.slug}`;

  const sectionPad = 'pt-[clamp(30px,4vw,64px)]';

  return (
    <div className="page-enter">
      <HydrateArtifacts cards={[card, ...moreFromEntity, ...entityCards]} />

      {/*
       * Headline first, then the reaction flow across the full width beneath
       * it. The flow reads left to right, so it gets the width rather than a
       * column beside the headline — and the reader still meets both in one
       * screen.
       */}
      <section className="rail pt-[clamp(24px,3.2vw,52px)]">
        <div className="max-w-[min(100%,860px)]">
          <nav
            aria-label="Breadcrumb"
            className="mb-[clamp(16px,2vw,24px)] flex flex-wrap items-center gap-2 text-xs font-semibold uppercase leading-none tracking-[0.06em] text-tertiary"
          >
            <Link href="/flash-news" className="text-secondary hover:text-primary">
              Stories
            </Link>
            {primaryEntity && (
              <>
                <span aria-hidden="true">/</span>
                <Link href={`/entities/${primaryEntity.slug}`} className="text-secondary hover:text-primary">
                  {primaryEntity.name}
                </Link>
              </>
            )}
            <span aria-hidden="true">/</span>
            <span>{card.category}</span>
          </nav>

          <div className="mb-[clamp(14px,1.8vw,20px)] flex flex-wrap items-center gap-2.5">
            <span className="flag">{card.category}</span>
            <span className="text-xs font-semibold uppercase leading-none tracking-[0.06em] text-tertiary">
              Published <LocalDateTime iso={card.publishedAt} />
            </span>
          </div>

          <h1 className="display m-0 text-[clamp(40px,6vw,96px)] text-primary">{card.title}</h1>

          {card.subtitle && (
            <p className="m-0 mt-[clamp(16px,2vw,24px)] max-w-[46ch] text-pretty text-[clamp(17px,1.35vw,23px)] leading-[1.5] text-secondary">
              {card.subtitle}
            </p>
          )}

          <div className="mt-[clamp(20px,2.4vw,30px)] flex flex-wrap items-center gap-3">
            <ShareReceipt card={card} url={shareUrl} />
            {primaryEntity && (
              <a
                href="#entity"
                className="border-b-2 border-[color:var(--color-indigo-bright)] px-4 py-3.5 text-[13px] font-bold leading-none text-primary"
              >
                Related profile: {primaryEntity.name}
              </a>
            )}
          </div>
        </div>

      </section>

      <section className="rail pt-[clamp(24px,3vw,44px)]">
        <OpinionFlow card={card} />
      </section>

      <section className={`rail flex flex-wrap items-start gap-[clamp(20px,2.6vw,40px)] ${sectionPad}`}>
        <article
          aria-labelledby="context-heading"
          className="paper min-w-[min(100%,300px)] flex-[1_1_520px] p-[clamp(20px,2.6vw,44px)]"
        >
          <h2 id="context-heading" className="display-sm m-0 mb-[clamp(16px,2vw,24px)] text-[clamp(26px,3vw,44px)]">
            What happened
          </h2>

          {card.subtitle && (
            <p className="m-0 mb-[18px] max-w-[56ch] text-pretty text-[clamp(17px,1.35vw,21px)] leading-[1.55]">
              {card.subtitle}
            </p>
          )}

          {item.body && (
            <p className="m-0 max-w-[62ch] whitespace-pre-line text-pretty text-[clamp(15px,1.15vw,17.5px)] leading-[1.65] text-[rgb(23_20_15_/_0.7)]">
              {item.body}
            </p>
          )}

          {item.details.length > 0 && (
            <DetailsList details={item.details} className="mt-6 border-t border-[var(--rule-subtle)] pt-5" />
          )}

          {item.sourceLabel && (
            <p className="m-0 mt-6 border-t border-[var(--rule-subtle)] pt-4 text-xs font-semibold uppercase leading-none tracking-[0.08em] text-[rgb(23_20_15_/_0.62)]">
              Source:{' '}
              {item.sourceUrl ? (
                <a
                  href={item.sourceUrl}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                  className="text-ink underline underline-offset-4"
                >
                  {item.sourceLabel}
                </a>
              ) : (
                item.sourceLabel
              )}
            </p>
          )}
        </article>

        <RelatedEntityAside entities={relatedEntities} cards={entityCards} id="entity" />
      </section>

      <section className={`rail ${sectionPad}`}>
        <Suspense fallback={<SectionSkeleton label="Loading the history" height="520px" />}>
          <DeferredAnalytics card={card} />
        </Suspense>
      </section>

      <section className={`rail ${sectionPad}`}>
        <Suspense fallback={<SectionSkeleton label="Loading the discussion" height="420px" />}>
          <DeferredComments
            card={card}
            viewerId={viewerId}
            viewerIsAdmin={user?.isAdmin ?? false}
            viewerName={user?.displayName ?? null}
          />
        </Suspense>
      </section>

      {moreFromEntity.length > 0 && primaryEntity && (
        <section className={`rail ${sectionPad}`}>
          <div className="mb-[clamp(16px,2vw,28px)] flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--border-default)] pb-4">
            <h2 className="display m-0 text-[clamp(26px,3.4vw,48px)]">More about {primaryEntity.name}</h2>
            <Link
              href={`/entities/${primaryEntity.slug}`}
              className="border-b-2 border-[color:var(--color-indigo)] pb-1 text-[13px] font-bold leading-none"
            >
              Profile page →
            </Link>
          </div>
          <CardGrid cards={moreFromEntity} columns={3} />
        </section>
      )}

      <StickyReactionTray card={card} watchTargetId="reaction-controls" />
    </div>
  );
}
