'use client';

import { useState } from 'react';
import { downloadMoodStamp } from '@/lib/client/moodstamp-image';
import type { MoodStampArtworkData } from '@/lib/moodstamps/types';

export function DownloadStampButton({ artwork }: { artwork: MoodStampArtworkData }) {
  const [state, setState] = useState<'idle' | 'working' | 'failed'>('idle');

  return (
    <div>
      <button
        type="button"
        disabled={state === 'working'}
        onClick={async () => {
          setState('working');
          setState((await downloadMoodStamp(artwork)) ? 'idle' : 'failed');
        }}
        className="ms-key ms-cta w-full sm:w-auto"
      >
        {state === 'working' ? 'Preparing…' : 'Download image'}
      </button>
      {state === 'failed' && (
        <p role="alert" className="mt-3 text-[13.5px] font-semibold text-[color:var(--color-egg)]">
          The image could not be made in this browser. Try again, or take a screenshot of the stamp.
        </p>
      )}
    </div>
  );
}
