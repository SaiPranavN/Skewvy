'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deliveryErrorMessage, type MoodStampRecord } from '@/lib/moodstamps/types';

/**
 * Emails a stamp that has not gone out: one whose send failed, or one saved
 * before email delivery existed. The outcome is shown right here, and the
 * page refreshes to the stamp's new state.
 */
export function DeliverNowButton({
  id,
  label,
  onDelivered,
}: {
  id: string;
  label: string;
  onDelivered?: (record: MoodStampRecord) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'working'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const deliver = async () => {
    setState('working');
    setMessage(null);
    try {
      const response = await fetch(`/api/moodstamps/${encodeURIComponent(id)}/deliver`, { method: 'POST' });
      const body = (await response.json().catch(() => ({}))) as { moodStamp?: MoodStampRecord; message?: string };
      if (response.status === 429) {
        setMessage('That was a lot of tries in a short time. Give it a few minutes.');
      } else if (!response.ok || !body.moodStamp) {
        setMessage(body.message ?? 'That did not go through. Try again.');
      } else if (body.moodStamp.delivery === 'delivered') {
        onDelivered?.(body.moodStamp);
        router.refresh();
      } else {
        setMessage(
          body.moodStamp.deliveryError
            ? deliveryErrorMessage(body.moodStamp.deliveryError)
            : 'It is already being sent. Refresh in a moment.',
        );
        router.refresh();
      }
    } catch {
      setMessage(navigator.onLine ? 'That did not go through. Try again.' : 'You are offline. Try again once you are back.');
    } finally {
      setState('idle');
    }
  };

  return (
    <div>
      <button type="button" onClick={deliver} disabled={state === 'working'} className="ms-key ms-cta w-full sm:w-auto">
        {state === 'working' ? 'Sending…' : label}
      </button>
      {message && (
        <p role="alert" className="mt-3 max-w-[46ch] text-[13.5px] font-semibold text-[color:var(--color-egg)]">
          {message}
        </p>
      )}
    </div>
  );
}
