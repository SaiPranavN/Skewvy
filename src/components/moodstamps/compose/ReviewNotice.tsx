'use client';

import { useEffect, useRef } from 'react';
import { REACTION_VOICES } from '@/lib/moodstamps/catalog';
import type { MoodStampReaction } from '@/lib/moodstamps/types';
import { CATEGORY_LABELS, type MoodStampReview, type ReviewField } from '@/lib/moodstamps/review-types';

export type ReviewRequest =
  | { draft: Record<string, unknown> }
  | { code: string; draft: Record<string, unknown>; senderName: string };

export type ReviewOutcome =
  | { kind: 'review'; review: MoodStampReview }
  | { kind: 'fields'; fields: Record<string, string> };

/**
 * Asks for the AI review of a finished stamp. Anything that keeps the answer
 * from arriving — offline, a timeout, too many checks — lets the sender carry
 * on: the send itself is checked again on the server, so stepping aside here
 * never lets a blocked stamp through.
 */
export async function requestReview(body: ReviewRequest): Promise<ReviewOutcome> {
  try {
    const response = await fetch('/api/moodstamps/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as { review?: MoodStampReview; fields?: Record<string, string> };
    if (response.status === 422 && data.fields) return { kind: 'fields', fields: data.fields };
    if (response.ok && data.review) return { kind: 'review', review: data.review };
  } catch {
    // Fall through: carry on without the review.
  }
  return { kind: 'review', review: { verdict: 'unchecked', categories: [], message: '', notes: [] } };
}

function fieldLabel(field: ReviewField, reaction: MoodStampReaction | null): string {
  const voice = REACTION_VOICES[reaction ?? 'medal'];
  switch (field) {
    case 'emotion':
      return 'The feeling';
    case 'reasonWhat':
      return voice.reasons[0].label;
    case 'reasonImpact':
      return voice.reasons[1].label;
    case 'reasonRequest':
      return voice.reasons[2].label;
    case 'recipientName':
      return 'Their name';
    case 'senderName':
      return 'Your name';
  }
}

/**
 * What the review found, said to the sender before anything is sent: why,
 * where, and a better way to say it that they can take with one press. A
 * rewrite can still be previewed as written; a block cannot.
 */
export function ReviewNotice({
  review,
  reaction,
  onApply,
  onProceed,
  onDismiss,
}: {
  review: MoodStampReview;
  reaction: MoodStampReaction | null;
  onApply: (field: ReviewField, text: string) => void;
  /** Only offered for a rewrite. */
  onProceed: () => void;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const blocked = review.verdict === 'block';

  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    ref.current?.focus({ preventScroll: true });
  }, [review]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="msc-review-title"
      className="msc-card msc-review focus:outline-none"
      data-verdict={review.verdict}
    >
      <p className="msc-label">{blocked ? 'Cannot be sent' : 'A second look'}</p>
      <h2 id="msc-review-title" className="mt-2 text-[19px] font-extrabold leading-snug">
        {blocked ? 'This MoodStamp can’t be sent as it is written.' : 'This may land harder than you mean it to.'}
      </h2>
      <p className="mt-2 text-[14.5px] leading-relaxed text-[rgb(23_20_15/0.78)]">{review.message}</p>

      {review.categories.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="What was found">
          {review.categories.map((category) => (
            <li key={category} className="msc-review-tag">
              {CATEGORY_LABELS[category]}
            </li>
          ))}
        </ul>
      )}

      {review.notes.length > 0 && (
        <ul className="mt-4 space-y-3">
          {review.notes.map((note) => (
            <li key={note.field} className="border-t border-[rgb(23_20_15/0.14)] pt-3">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-[rgb(23_20_15/0.6)]">
                {fieldLabel(note.field, reaction)}
              </p>
              <p className="mt-1 text-[14px] leading-snug">{note.issue}</p>
              {note.suggestion && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <q className="text-[14px] font-semibold leading-snug">{note.suggestion}</q>
                  <button
                    type="button"
                    onClick={() => onApply(note.field, note.suggestion!)}
                    className="msr-button min-h-10 flex-none px-3.5 text-[13px]"
                  >
                    Use this wording
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {review.categories.includes('self_harm') && (
        <p className="mt-4 border-l-4 border-[color:var(--color-violet)] pl-3 text-[13.5px] leading-relaxed">
          If things feel heavy right now, you do not have to carry it alone. In India, Tele-MANAS is free and open
          around the clock on <a href="tel:14416" className="font-bold underline">14416</a>. Anywhere else,{' '}
          <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer" className="font-bold underline">
            findahelpline.com
          </a>{' '}
          lists someone to talk to.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" onClick={onDismiss} className="msr-button">
          Edit it myself
        </button>
        {!blocked && (
          <button type="button" onClick={onProceed} className="msr-button msr-button-quiet">
            Preview it as written
          </button>
        )}
      </div>
    </div>
  );
}
