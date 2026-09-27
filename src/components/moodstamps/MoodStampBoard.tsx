import type { MoodStampSummary, MoodStampView } from '@/lib/moodstamps/types';
import { MoodStampCard } from './MoodStampCard';
import { MoodStampBoardSkeleton } from './MoodStampCardSkeleton';
import { MoodStampEmptyState } from './MoodStampEmptyState';

/** Everything the board can be showing. Where the data comes from is not its concern. */
export type MoodStampBoardState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'offline' }
  | { status: 'ready'; items: MoodStampSummary[]; stale?: boolean };

/**
 * The board itself: a wall of collected stamps, or the invitation to start one.
 *
 * It only ever shows one of those. The introduction belongs to an empty board,
 * and never sits above a board that already has something on it.
 */
export function MoodStampBoard({
  view,
  state,
  onRetry,
}: {
  view: MoodStampView;
  state: MoodStampBoardState;
  onRetry: () => void;
}) {
  if (state.status === 'loading') return <MoodStampBoardSkeleton />;

  if (state.status === 'error') {
    return (
      <BoardNotice
        title="Your board didn’t load."
        body="Nothing is lost — this is only the page failing to fetch it. Try again."
        action={
          <button type="button" onClick={onRetry} className="ms-key ms-cta">
            Retry
          </button>
        }
      />
    );
  }

  if (state.status === 'offline') {
    return (
      <BoardNotice
        title="You’re offline."
        body="Your board will load as soon as the connection returns."
        action={
          <button type="button" onClick={onRetry} className="btn btn-outline min-h-[52px]">
            Try now
          </button>
        }
      />
    );
  }

  if (state.items.length === 0) return <MoodStampEmptyState view={view} />;

  return (
    <>
      {state.stale && (
        <p role="status" className="mb-5 text-[13px] font-semibold text-secondary">
          Offline. Showing your board as it last loaded.
        </p>
      )}
      <ul className="ms-grid" aria-label={view === 'received' ? 'MoodStamps you received' : 'MoodStamps you sent'}>
        {state.items.map((stamp) => (
          <li key={stamp.id} className="flex min-w-0">
            <MoodStampCard stamp={stamp} />
          </li>
        ))}
      </ul>
    </>
  );
}

function BoardNotice({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div role="status" className="max-w-[560px] border-l-[3px] border-[var(--color-violet)] py-2 pl-6">
      <h2 className="display-sm text-[clamp(24px,2.6vw,32px)]">{title}</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-secondary">{body}</p>
      <div className="mt-6">{action}</div>
    </div>
  );
}
