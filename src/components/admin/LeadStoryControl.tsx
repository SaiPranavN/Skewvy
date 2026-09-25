'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setLeadStoryAction } from '@/app/admin/actions';

/**
 * Makes one Story the lead on the Stories page, or gives the choice back to
 * "newest first". Only offered for published Stories: an unpublished one could
 * not be shown, so pinning it would do nothing visible.
 */
export function LeadStoryControl({
  id,
  isLead,
  published,
}: {
  id: string;
  isLead: boolean;
  published: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!published && !isLead) return null;

  const run = (next: string | null) => {
    setError(null);
    startTransition(async () => {
      const result = await setLeadStoryAction(next);
      if (!result.ok) setError(result.message ?? 'That did not work.');
      else router.refresh();
    });
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {isLead ? (
        <>
          <span className="inline-flex min-h-9 items-center gap-1.5 bg-[color:var(--color-medal)] px-2.5 text-xs font-bold text-[color:var(--color-ink)]">
            ★ Lead story
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(null)}
            className="min-h-9 rounded-[var(--radius-control)] border border-[var(--border-default)] px-3 text-xs text-secondary transition-colors hover:border-[var(--border-strong)] hover:text-primary disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Stop pinning'}
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(id)}
          className="min-h-9 rounded-[var(--radius-control)] border border-[var(--border-default)] px-3 text-xs text-primary transition-colors hover:border-[var(--border-strong)] disabled:opacity-50"
        >
          {pending ? 'Saving…' : '☆ Make lead story'}
        </button>
      )}
      {error && <span className="text-xs text-brand">{error}</span>}
    </span>
  );
}
