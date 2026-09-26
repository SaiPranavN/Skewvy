import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ReportsQueue } from '@/components/admin/ReportsQueue';
import { requireAdmin } from '@/lib/auth/current-user';
import { listReportedComments } from '@/lib/services/comments';
import { listOpenSiteReports } from '@/lib/services/site-reports';
import { SiteReportsQueue } from '@/components/admin/SiteReportsQueue';
import { formatCount } from '@/lib/domain/format';

export const metadata: Metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

export default async function AdminReportsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect('/login?redirectTo=/admin/reports');

  const [reported, siteReports] = await Promise.all([listReportedComments(), listOpenSiteReports()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium tracking-[-0.01em] text-primary">Reported comments</h1>
        <p className="mt-1 text-sm text-secondary">
          {reported.length === 0
            ? 'Nothing waiting for review.'
            : `${formatCount(reported.length)} comment${reported.length === 1 ? '' : 's'} waiting for review, most-reported first.`}
        </p>
      </div>

      <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-surface px-4 py-3">
        <p className="text-sm leading-relaxed text-secondary">
          A report hides nothing by itself. <span className="text-primary">Remove</span> takes the comment down for
          everyone. <span className="text-primary">Keep</span> leaves it up and closes its reports. Either way, reporters
          are never shown to the author.
        </p>
      </div>

      <ReportsQueue reported={reported} />

      <section aria-labelledby="site-reports-heading" className="space-y-3 pt-4">
        <div>
          <h2 id="site-reports-heading" className="text-lg font-medium tracking-[-0.01em] text-primary">
            From the report form
          </h2>
          <p className="mt-1 text-sm text-secondary">
            Sent through /report — pages, comments, facts or anything else. Reporters are never shown publicly.
          </p>
        </div>
        <SiteReportsQueue reports={siteReports} />
      </section>
    </div>
  );
}
