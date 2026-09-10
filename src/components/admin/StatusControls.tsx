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

export function StatusBadge({ status }: { status: ContentStatus }) {
  const tone =
    status === 'published'
      ? 'bg-good/14 text-good border-good/25'
      : status === 'draft'
        ? 'bg-white/8 text-haze border-white/14'
        : 'bg-egg/12 text-egg border-egg/22';

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.12em] ${tone}`}>
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
          className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-medium text-haze transition-colors hover:border-white/28 hover:text-chalk disabled:opacity-50"
        >
          {action.label}
        </button>
      ))}
      {error && (
        <span role="alert" className="text-xs text-brand-bright">
          {error}
        </span>
      )}
    </div>
  );
}
