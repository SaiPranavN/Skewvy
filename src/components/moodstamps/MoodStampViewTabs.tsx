'use client';

import { useRef } from 'react';
import { MOODSTAMP_VIEWS, type MoodStampCounts, type MoodStampView } from '@/lib/moodstamps/types';

const LABELS: Record<MoodStampView, string> = { received: 'Received', sent: 'Sent' };

export function moodStampTabId(view: MoodStampView): string {
  return `moodstamps-tab-${view}`;
}

export const MOODSTAMP_PANEL_ID = 'moodstamps-board';

/**
 * Received and Sent, as a real tab list.
 *
 * Arrow keys move between the two and select as they go (there are only two,
 * and both are already loaded, so selecting on focus costs nothing). Only the
 * selected tab is in the Tab order. A count appears only when there is
 * something to count — a zero next to an empty board says nothing the board
 * does not.
 */
export function MoodStampViewTabs({
  view,
  counts,
  onChange,
}: {
  view: MoodStampView;
  counts: MoodStampCounts | null;
  onChange: (view: MoodStampView) => void;
}) {
  const tabRefs = useRef<Record<MoodStampView, HTMLButtonElement | null>>({ received: null, sent: null });

  const move = (next: MoodStampView) => {
    onChange(next);
    tabRefs.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = MOODSTAMP_VIEWS.indexOf(view);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      move(MOODSTAMP_VIEWS[(index + step + MOODSTAMP_VIEWS.length) % MOODSTAMP_VIEWS.length]);
    } else if (event.key === 'Home') {
      event.preventDefault();
      move(MOODSTAMP_VIEWS[0]);
    } else if (event.key === 'End') {
      event.preventDefault();
      move(MOODSTAMP_VIEWS[MOODSTAMP_VIEWS.length - 1]);
    }
  };

  return (
    <div role="tablist" aria-label="Your MoodStamps" className="ms-tabs" data-view={view} onKeyDown={onKeyDown}>
      <span aria-hidden="true" className="ms-tab-indicator" />
      {MOODSTAMP_VIEWS.map((option) => {
        const selected = option === view;
        const count = counts?.[option] ?? 0;
        return (
          <button
            key={option}
            ref={(node) => {
              tabRefs.current[option] = node;
            }}
            id={moodStampTabId(option)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={MOODSTAMP_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option)}
            className="ms-tab"
          >
            {LABELS[option]}
            {count > 0 && (
              <span className="ms-tab-count">
                <span className="sr-only">, </span>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
