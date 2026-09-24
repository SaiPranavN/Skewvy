'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { resolveReportAction } from '@/app/admin/actions';
import { REPORT_REASON_LABELS } from '@/lib/domain/reports';
import type { ReportedComment } from '@/lib/services/comments';

/** One card per reported comment, with the two ways to close it. */
export function ReportsQueue({ reported }: { reported: ReportedComment[] }) {
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (commentId: string, action: 'remove' | 'dismiss') => {
    startTransition(async () => {
      const result = await resolveReportAction(commentId, action);
      setNotice({ ok: result.ok, message: result.message ?? (result.ok ? 'Done.' : 'That did not work.') });
    });
  };

  return (
    <div className={pending ? 'opacity-60 transition-opacity duration-150' : ''}>
      {notice && (
        <p
          role="status"
          className={`mb-4 rounded-[var(--radius-control)] border px-4 py-3 text-sm ${
            notice.ok
              ? 'border-[var(--border-subtle)] bg-surface text-secondary'
              : 'border-[var(--border-default)] bg-surface text-error'
          }`}
        >
          {notice.message}
        </p>
      )}

      {reported.length === 0 ? (
        <p className="divider py-8 text-sm text-tertiary">No open reports.</p>
      ) : (
        <ul className="space-y-4">
          {reported.map((item) => {
            const href = item.artifact.slug
              ? `${item.artifact.type === 'entity' ? '/entities' : '/flash-news'}/${item.artifact.slug}`
              : null;

            return (
              <li key={item.commentId} className="panel rounded-[var(--radius-card)] p-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-tertiary">
                  <span className="rounded-[var(--radius-control)] border border-[var(--border-default)] px-2 py-1 font-semibold text-primary">
                    {item.reportCount} report{item.reportCount === 1 ? '' : 's'}
                  </span>
                  <span>
                    On {item.artifact.type === 'entity' ? 'Profile' : 'Story'}{' '}
                    {href ? (
                      <Link href={href} className="text-secondary underline-offset-2 hover:text-primary hover:underline">
                        {item.artifact.title ?? 'Untitled'}
                      </Link>
                    ) : (
                      <span className="text-secondary">{item.artifact.title ?? 'Unpublished item'}</span>
                    )}
                  </span>
                  <span>
                    Last reported <RelativeTime iso={item.lastReportedAt} />
                  </span>
                </div>

                <blockquote className="mt-3 border-l-2 border-[var(--border-strong)] pl-3.5">
                  <p className="text-xs font-semibold text-secondary">
                    {item.author.displayName} · <RelativeTime iso={item.createdAt} />
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-primary">{item.body}</p>
                </blockquote>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.reasons.map(({ reason, count }) => (
                    <span
                      key={reason}
                      className="rounded-[var(--radius-control)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-secondary"
                    >
                      {REPORT_REASON_LABELS[reason].label}
                      {count > 1 ? ` × ${count}` : ''}
                    </span>
                  ))}
                </div>

                {item.notes.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs leading-relaxed text-secondary">
                    {item.notes.map((note, index) => (
                      <li key={index}>“{note}”</li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(item.commentId, 'remove')}
                    className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] bg-primary px-4 text-sm font-medium text-ground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
                  >
                    Remove comment
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(item.commentId, 'dismiss')}
                    className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-[var(--border-default)] px-4 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)] disabled:opacity-50"
                  >
                    Keep it up
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
