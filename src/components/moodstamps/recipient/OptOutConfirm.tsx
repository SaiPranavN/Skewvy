'use client';

import { useState } from 'react';

/**
 * The button that stops MoodStamp emails. Opening the page does nothing on
 * its own — mail scanners open every link — so it takes a deliberate press.
 */
export function OptOutConfirm({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');

  if (state === 'done') {
    return (
      <p role="status" className="mt-8 text-[16px] font-semibold text-primary">
        Done. Skewvy will not email MoodStamps to this address again.
      </p>
    );
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        disabled={state === 'working'}
        onClick={async () => {
          setState('working');
          try {
            const response = await fetch(`/api/moodstamps/opt-out?token=${encodeURIComponent(token)}`, {
              method: 'POST',
            });
            setState(response.ok ? 'done' : 'failed');
          } catch {
            setState('failed');
          }
        }}
        className="ms-key ms-cta w-full sm:w-auto"
      >
        {state === 'working' ? 'Stopping…' : 'Stop MoodStamps to my email'}
      </button>
      {state === 'failed' && (
        <p role="alert" className="mt-3 text-[14px] font-semibold text-[color:var(--color-egg)]">
          That did not go through. Try again in a moment.
        </p>
      )}
    </div>
  );
}
