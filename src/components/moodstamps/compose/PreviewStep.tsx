'use client';

import type { MoodStampArtworkData } from '@/lib/moodstamps/types';
import { MoodStampArtwork } from '../MoodStampArtwork';

/**
 * The stamp exactly as it will look, before anything leaves. Send moves on to
 * choosing where it goes; Edit goes back with everything as it was.
 */
export function PreviewStep({
  artwork,
  onEdit,
  onSend,
}: {
  artwork: MoodStampArtworkData;
  onEdit: () => void;
  onSend: () => void;
}) {
  return (
    <div className="max-w-[680px]">
      <div className="ms-example-in">
        <MoodStampArtwork data={artwork} />
      </div>

      <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onEdit} className="btn btn-outline min-h-[52px] w-full sm:w-auto">
          <span aria-hidden="true">←</span> Edit
        </button>
        <button type="button" onClick={onSend} className="ms-key ms-cta w-full sm:w-auto">
          Send it <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
