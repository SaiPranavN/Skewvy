'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RelativeTime } from '@/components/ui/TimeAgo';
import { resolveSiteReportAction } from '@/app/admin/actions';
import { SITE_REPORT_REASON_LABELS } from '@/lib/domain/site-reports';
import type { SiteReportView } from '@/lib/services/site-reports';

/** Reports sent through /report. Only admins ever see who sent them. */
export function SiteReportsQueue({ reports }: { reports: SiteReportView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  if (reports.length === 0) return <p className="divider py-6 text-sm text-tertiary">No open reports from the form.</p>;

  return (
    <div className={pending ? 'opacity-60 transition-opacity' : ''}>
      {notice && (
        <p role="status" className="mb-3 text-sm text-secondary">
          {notice}
        </p>
      )}
      <ul className="space-y-3">
        {reports.map((report) => (
          <li key={report.id} className="panel rounded-[var(--radius-card)] p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tertiary">
              <span className="border border-[var(--border-default)] px-2 py-1 font-semibold text-primary">
                {SITE_REPORT_REASON_LABELS[report.reason]}
              </span>
              <RelativeTime iso={report.createdAt} />
              <span>
                {report.reporterName ? `from ${report.reporterName}` : 'not signed in'}
                {report.contactEmail ? ` · ${report.contactEmail}` : ''}
              </span>
            </div>
            <a
              href={report.targetUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-2 block break-all text-sm font-semibold text-primary underline underline-offset-2"
            >
              {report.targetUrl}
            </a>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-secondary">{report.details}</p>
            {report.evidenceUrl && (
              <a
                href={report.evidenceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-1.5 block break-all text-xs text-secondary underline underline-offset-2"
              >
                Evidence: {report.evidenceUrl}
              </a>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await resolveSiteReportAction(report.id);
                  setNotice(result.message ?? null);
                  router.refresh();
                })
              }
              className="mt-3 inline-flex min-h-10 items-center border border-[var(--border-default)] px-4 text-sm text-primary hover:border-[var(--border-strong)] disabled:opacity-50"
            >
              Mark reviewed
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
