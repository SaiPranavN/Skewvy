import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ReactionSlab } from '@/components/artifact/ReactionSlab';
import { PublicOpinionPanel } from '@/components/artifact/PublicOpinionPanel';
import { YourOpinionCard } from '@/components/artifact/YourOpinionCard';
import { RecentActivityPanel } from '@/components/artifact/RecentActivityPanel';
import { StickyReactionTray } from '@/components/artifact/StickyReactionTray';
import { ReactionTrendChart } from '@/components/artifact/ReactionTrendChart';
import { CommentSection } from '@/components/artifact/CommentSection';
import { HydrateArtifacts } from '@/components/reactions/HydrateArtifacts';
import { CardGrid } from '@/components/cards/CardGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShareReceipt } from '@/components/share/ShareReceipt';
import { Media, initialsFor } from '@/components/ui/Media';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getEntityBySlug, listFlashNews, toCards } from '@/lib/services/content';
import { recentActivity } from '@/lib/services/reactions';
import { recentVelocity } from '@/lib/services/totals';
import { reactionTrend } from '@/lib/services/timeline';
import { listComments } from '@/lib/services/comments';
import { cardTone } from '@/lib/domain/copy';
import { EggIcon, MedalIcon } from '@/components/ui/icons';
import { formatCount, sharePercent } from '@/lib/domain/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entity = await getEntityBySlug(slug);
  if (!entity) return { title: 'Not found' };
  return {
    title: entity.name,
    description: entity.description,
    openGraph: {
      title: entity.name,
      description: entity.description,
      images: entity.imageUrl ? [entity.imageUrl] : [],
    },
  };
}

export default async function EntityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;

  const entity = await getEntityBySlug(slug);
  if (!entity) notFound();

  const [cards, relatedFlashNews, activity, velocity, trend, comments] = await Promise.all([
    toCards({ entities: [entity] }, { viewerId }),
    listFlashNews({ entityId: entity.id, limit: 12 }).then((items) =>
      toCards({ flashNews: items }, { viewerId, withVelocity: true }),
    ),
    recentActivity('entity', entity.id, 6),
    recentVelocity(24 * 60),
    reactionTrend('entity', entity.id),
    listComments('entity', entity.id, { viewerId, viewerIsAdmin: user?.isAdmin ?? false }),
  ]);

  const card = cards[0];
  const recent = velocity.get(`entity:${entity.id}`) ?? { rottenEggs: 0, medals: 0 };
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/entities/${entity.slug}`;

  const badge = cardTone(card.totals);
  const eggs = card.totals.rottenEggTotal;
  const medals = card.totals.medalTotal;
  const eggShare = sharePercent(eggs, eggs + medals);

  const sectionPad = 'pt-[clamp(30px,4vw,64px)]';

  return (
    <div className={`page-enter tone-${badge.tone}`}>
      <HydrateArtifacts cards={[card, ...relatedFlashNews]} />

      {/*
       * An entity leads with identity rather than a headline: the mark, the
       * name and what the thing is, with the standing record beside it.
       */}
      <section className="rail flex flex-wrap items-start gap-[clamp(22px,3vw,52px)] pt-[clamp(24px,3.2vw,52px)]">
        <div className="min-w-[min(100%,300px)] flex-[1_1_440px]">
          <nav
            aria-label="Breadcrumb"
            className="mb-[clamp(16px,2vw,24px)] flex flex-wrap items-center gap-2 text-xs font-semibold uppercase leading-none tracking-[0.06em] text-tertiary"
          >
            <Link href="/entities" className="text-secondary hover:text-primary">
              Entities
            </Link>
            <span aria-hidden="true">/</span>
            <span>{entity.category}</span>
          </nav>

          <div className="flex flex-wrap items-start gap-[clamp(16px,2vw,26px)]">
            <Media
              src={entity.imageUrl}
              alt=""
              fallbackLabel={initialsFor(entity.name)}
              fallbackKind="initials"
              sizes="120px"
              priority
              className="h-[clamp(84px,9vw,120px)] w-[clamp(84px,9vw,120px)] flex-none border-2 border-[var(--border-strong)]"
            />

            <div className="min-w-[min(100%,260px)] flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2.5">
                <span className="flag">{entity.category}</span>
                <span className="tone-badge">{badge.entityLabel}</span>
              </div>

              <h1 className="display m-0 text-[clamp(36px,5.2vw,84px)] text-primary">{entity.name}</h1>
            </div>
          </div>

          <p className="m-0 mt-[clamp(16px,2vw,24px)] max-w-[48ch] text-pretty text-[clamp(16px,1.3vw,21px)] leading-[1.5] text-secondary">
            {entity.description}
          </p>

          <div className="mt-[clamp(20px,2.4vw,30px)] flex flex-wrap items-center gap-3">
            <ShareReceipt card={card} url={shareUrl} />
            {relatedFlashNews.length > 0 && (
              <a
                href="#stories"
                className="border-b-2 border-[color:var(--color-indigo-bright)] px-4 py-3.5 text-[13px] font-bold leading-none text-primary"
              >
                {formatCount(relatedFlashNews.length)} Flash News {relatedFlashNews.length === 1 ? 'item' : 'items'}
              </a>
            )}
          </div>

          {/* The lifetime split, and what has moved in the last day. */}
          <div className="mt-[clamp(22px,2.6vw,34px)] max-w-[520px] border border-[var(--border-default)] p-[clamp(16px,1.8vw,24px)]">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="eyebrow">Lifetime record</p>
              <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.08em] text-tertiary">
                {recent.rottenEggs + recent.medals > 0 ? (
                  <>
                    +{formatCount(recent.rottenEggs)} <EggIcon /> / +{formatCount(recent.medals)} <MedalIcon /> today
                  </>
                ) : (
                  'Nothing new today'
                )}
              </p>
            </div>

            <div
              className="split-bar mt-3.5"
              role="img"
              aria-label={`Lifetime split: ${formatCount(eggs)} eggs, ${formatCount(medals)} medals.`}
            >
              <span style={{ width: `${eggs + medals > 0 ? eggShare : 50}%` }} />
            </div>

            <p className="mt-3.5 text-xs leading-[1.5] text-tertiary">
              These totals belong to the entity itself. Reactions to individual Flash News items are counted separately
              on those pages.
            </p>
          </div>

          <YourOpinionCard card={card} />
        </div>

        <div
          id="reaction-controls"
          className="flex min-w-[min(100%,290px)] max-w-[520px] flex-[1_1_330px] flex-col gap-4"
        >
          <ReactionSlab card={card} reactionType="rotten_egg" />
          <ReactionSlab card={card} reactionType="medal" />
        </div>
      </section>

      <section className={`rail ${sectionPad}`}>
        <ReactionTrendChart trend={trend} artifactType="entity" artifactId={entity.id} totals={card.totals} />
      </section>

      <section className={`rail flex flex-wrap items-start gap-[clamp(20px,2.6vw,40px)] ${sectionPad}`}>
        <PublicOpinionPanel card={card} />
        <RecentActivityPanel activity={activity} />
      </section>

      <section className={`rail ${sectionPad}`}>
        <CommentSection
          artifactType="entity"
          artifactId={entity.id}
          initial={comments}
          viewerName={user?.displayName ?? null}
        />
      </section>

      <section id="stories" className={`rail scroll-mt-24 ${sectionPad}`}>
        <div className="mb-[clamp(16px,2vw,28px)]">
          <h2 className="display m-0 text-[clamp(26px,3.4vw,48px)]">Related Flash News</h2>
          <p className="mt-3 max-w-[56ch] text-[15px] leading-[1.5] text-secondary">
            Specific events involving {entity.name}, each with its own reaction totals.
          </p>
        </div>

        {relatedFlashNews.length === 0 ? (
          <EmptyState
            title="No Flash News yet"
            description="Nothing specific has been filed against this entity. Its lifetime counters above remain open."
            action={{ href: '/flash-news', label: 'Browse Flash News' }}
          />
        ) : (
          <CardGrid cards={relatedFlashNews} columns={4} />
        )}
      </section>

      <StickyReactionTray card={card} watchTargetId="reaction-controls" />
    </div>
  );
}
