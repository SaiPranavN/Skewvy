'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import {
  moodStampBoardHref,
  parseMoodStampView,
  type MoodStampBoardResult,
  type MoodStampView,
} from '@/lib/moodstamps/types';
import { MoodStampBoard, type MoodStampBoardState } from './MoodStampBoard';
import { MoodStampCreateMenu } from './MoodStampCreateMenu';
import { MOODSTAMP_PANEL_ID, MoodStampViewTabs, moodStampTabId } from './MoodStampViewTabs';
import { useMoodStampBoard } from './useMoodStampBoard';

/**
 * The private MoodStamps area: a short header, one control bar, the board.
 *
 * The selected view lives in the URL and nowhere else. Switching pushes a
 * history entry without a navigation — Next keeps `useSearchParams` in step
 * with `history.pushState` — so Back and Forward move between Received and
 * Sent, and a copied link opens on the same side it was copied from.
 */
export function MoodStampsPage({ initial }: { initial: MoodStampBoardResult }) {
  const searchParams = useSearchParams();
  const view = parseMoodStampView(searchParams.get('view'));
  const { load, online, refresh } = useMoodStampBoard(initial);

  const selectView = useCallback(
    (next: MoodStampView) => {
      if (next === view && searchParams.get('view') === next) return;
      window.history.pushState(null, '', moodStampBoardHref(next));
    },
    [view, searchParams],
  );

  const boardState: MoodStampBoardState =
    load.status === 'ready' ? { status: 'ready', items: load.data[view], stale: !online } : load;

  return (
    <div className="rail page-enter pb-[clamp(48px,6vw,96px)]">
      <header className="pt-[clamp(24px,3vw,44px)]">
        <p className="eyebrow text-[color:var(--color-violet)]">Personal expressions</p>
        <h1 className="display mt-3 text-[clamp(36px,4.4vw,60px)]">MoodStamps</h1>
        <p className="mt-3 max-w-[56ch] text-[clamp(15px,1.15vw,17px)] leading-[1.5] text-secondary">
          Some feelings are too big for a text and too important to swallow — the thank-you you never said out loud,
          the frustration you keep biting back. <span className="font-semibold text-primary">Send what you felt. Keep what
          people sent you.</span>
        </p>
      </header>

      <div className="mt-[clamp(22px,2.6vw,34px)] flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-[clamp(18px,2vw,24px)]">
        <MoodStampViewTabs
          view={view}
          counts={load.status === 'ready' ? load.data.counts : null}
          onChange={selectView}
        />
        <MoodStampCreateMenu />
      </div>

      <div
        id={MOODSTAMP_PANEL_ID}
        role="tabpanel"
        aria-labelledby={moodStampTabId(view)}
        className="pt-[clamp(28px,3.6vw,56px)]"
      >
        <MoodStampBoard view={view} state={boardState} onRetry={refresh} />
      </div>
    </div>
  );
}
