'use client';

import { useState, useTransition } from 'react';
import { setStatusAction } from '@/app/admin/actions';
import type { ArtifactType, ContentStatus } from '@/lib/domain/types';

const NEXT_ACTIONS: Record<ContentStatus, Array<{ status: ContentStatus; label: string }>> = {
  draft: [
    { status: 'published', label: 'Publish' },
    { status: 'archived', label: 'Archive' },
  ],
  published: [
    { status: 'draft', label: 'Unpublish' },
    { status: 'archived', label: 'Archive' },
  ],
  archived: [
    { status: 'draft', label: 'Restore as draft' },
    { status: 'published', label: 'Publish' },
  ],
};

/** Publication state as a dot and a word, not a coloured pill. */
export function StatusBadge({ status }: { status: ContentStatus }) {
  const dot =
    status === 'published' ? 'bg-success' : status === 'draft' ? 'bg-tertiary' : 'bg-egg';

  return (
    <span className="inline-flex items-center gap-1.5 text-xs capitalize text-secondary">
      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 ${dot}`} />
      {status}
    </span>
  );
}

export function StatusControls({
  type,
  id,
  status,
}: {
  type: ArtifactType;
  id: string;
  status: ContentStatus;
}) {
  const [current, setCurrent] = useState(status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const apply = (next: ContentStatus) => {
    const previous = current;
    setCurrent(next);
    setError(null);
    startTransition(async () => {
      const result = await setStatusAction(type, id, next);
      if (!result.ok) {
        setCurrent(previous);
        setError(result.message ?? 'That did not work.');
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={current} />
      {NEXT_ACTIONS[current].map((action) => (
        <button
          key={action.status}
          type="button"
          onClick={() => apply(action.status)}
          disabled={pending}
          className="rounded-[var(--radius-control)] border border-[var(--border-default)] px-2.5 py-1.5 text-xs text-secondary transition-colors duration-150 hover:border-[var(--border-strong)] hover:text-primary disabled:opacity-50"
        >
          {action.label}
        </button>
      ))}
      {error && (
        <span role="alert" className="text-xs text-brand">
          {error}
        </span>
      )}
    </div>
  );
}
