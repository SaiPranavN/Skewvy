import { AnalyticsSection } from './AnalyticsSection';
import { CommentSection } from './CommentSection';
import { artifactTrends } from '@/lib/services/timeline';
import { listComments } from '@/lib/services/comments';
import type { ArtifactCard } from '@/lib/domain/types';

/**
 * The parts of a detail page that sit below the reaction flow.
 *
 * Each fetches its own data inside a Suspense boundary, so the page streams:
 * the header and the flow — what someone came to see and press — go out as
 * soon as the item itself is loaded, and the charts and the discussion follow
 * in the same response a moment later instead of holding the whole page back.
 */

export async function DeferredAnalytics({ card }: { card: ArtifactCard }) {
  const trends = await artifactTrends(card.type, card.id);
  return <AnalyticsSection card={card} trends={trends} />;
}

export async function DeferredComments({
  card,
  viewerId,
  viewerIsAdmin,
  viewerName,
}: {
  card: ArtifactCard;
  viewerId: string | null;
  viewerIsAdmin: boolean;
  viewerName: string | null;
}) {
  const comments = await listComments(card.type, card.id, { viewerId, viewerIsAdmin });
  return <CommentSection card={card} initial={comments} viewerName={viewerName} renderedAt={Date.now()} />;
}

/** Holds the space a section will fill, so nothing jumps when it arrives. */
export function SectionSkeleton({ label, height }: { label: string; height: string }) {
  return (
    <div className="paper p-[clamp(20px,2.6vw,40px)]" aria-busy="true" aria-label={label}>
      <div className="skeleton h-7 w-48 bg-[rgb(23_20_15_/_0.09)]" />
      <div className="skeleton mt-3 h-3.5 w-full max-w-[56ch] bg-[rgb(23_20_15_/_0.07)]" />
      <div className="skeleton mt-6 w-full bg-[rgb(23_20_15_/_0.06)]" style={{ height }} />
    </div>
  );
}
