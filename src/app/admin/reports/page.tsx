import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ReportsQueue } from '@/components/admin/ReportsQueue';
import { requireAdmin } from '@/lib/auth/current-user';
import { listReportedComments } from '@/lib/services/comments';
import { listOpenSiteReports } from '@/lib/services/site-reports';
import { SiteReportsQueue } from '@/components/admin/SiteReportsQueue';
import { formatExact } from '@/lib/domain/format';
import { aiReviewEnabled, listFlaggedReviews, reviewHealth } from '@/lib/services/moodstamp-review';
import { CATEGORY_LABELS, type ReviewCategory } from '@/lib/moodstamps/review-types';

export const metadata: Metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

export default async function AdminReportsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect('/login?redirectTo=/admin/reports');

  const [reported, siteReports, flagged] = await Promise.all([
    listReportedComments(),
    listOpenSiteReports(),
    listFlaggedReviews(50),
  ]);
  const health = await reviewHealth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium tracking-[-0.01em] text-primary">Reported comments</h1>
        <p className="mt-1 text-sm text-secondary">
          {reported.length === 0
            ? 'Nothing waiting for review.'
            : `${formatExact(reported.length)} comment${reported.length === 1 ? '' : 's'} waiting for review, most-reported first.`}
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

      <section aria-labelledby="moodstamp-review-heading" className="space-y-3 pt-4">
        <div>
          <h2 id="moodstamp-review-heading" className="text-lg font-medium tracking-[-0.01em] text-primary">
            MoodStamps the AI review held back
          </h2>
          <p className="mt-1 text-sm text-secondary">
            The last 50 the review asked to be reworded or blocked. Blocked ones were never sent; a reworded one may
            have been sent as written after the sender saw the note.
          </p>
          <p
            className={`mt-2 text-sm font-semibold ${
              aiReviewEnabled() && (!health || health.state === 'ok') ? 'text-[color:var(--color-success)]' : 'text-[color:var(--color-egg)]'
            }`}
          >
            {!aiReviewEnabled()
              ? 'AI review is OFF on this deployment: ANTHROPIC_API_KEY is not set, so only the word checks run.'
              : !health
                ? 'AI review is on. It has not been used yet.'
                : health.state === 'ok'
                  ? `AI review is working (${health.detail}), last confirmed ${new Date(health.at).toLocaleString('en-IN')}.`
                  : `AI review is NOT working since ${new Date(health.at).toLocaleString('en-IN')}: ${health.detail}. Stamps are going out with only the word checks.`}
          </p>
        </div>
        {flagged.length === 0 ? (
          <p className="text-sm text-tertiary">Nothing held back yet.</p>
        ) : (
          <ul className="space-y-3">
            {flagged.map((item, index) => (
              <li
                key={`${item.createdAt}-${index}`}
                className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-surface px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`px-1.5 py-0.5 font-bold uppercase tracking-[0.06em] ${
                      item.verdict === 'block' ? 'bg-egg text-ink' : 'bg-medal text-ink'
                    }`}
                  >
                    {item.verdict === 'block' ? 'Blocked' : 'Reword'}
                  </span>
                  {item.categories.map((category) => (
                    <span key={category} className="border border-[var(--border-default)] px-1.5 py-0.5 text-secondary">
                      {CATEGORY_LABELS[category as ReviewCategory] ?? category}
                    </span>
                  ))}
                  <span className="text-tertiary">{new Date(item.createdAt).toLocaleString('en-IN')}</span>
                  {item.senderKey && <span className="text-tertiary">{item.senderKey.slice(0, 18)}</span>}
                </div>
                <p className="mt-2 text-sm text-secondary">{item.message}</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-primary">{item.excerpt}</pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
