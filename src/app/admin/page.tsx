import Link from 'next/link';
import type { Metadata } from 'next';
import { query } from '@/lib/db';
import { formatCount } from '@/lib/domain/format';
import { StatBlock, type Stat } from '@/components/ui/StatBlock';
import { pinAlgorithm } from '@/lib/services/pin';
import { getDb } from '@/lib/db';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const db = await getDb();

  const [counts] = await query<{
    entities: number;
    published_entities: number;
    flash_news: number;
    published_flash_news: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM entities) AS entities,
       (SELECT COUNT(*) FROM entities WHERE status = 'published') AS published_entities,
       (SELECT COUNT(*) FROM flash_news) AS flash_news,
       (SELECT COUNT(*) FROM flash_news WHERE status = 'published') AS published_flash_news`,
  );

  const [totals] = await query<{
    eggs: number | null;
    medals: number | null;
    positive: number | null;
    negative: number | null;
    participants: number | null;
  }>(
    `SELECT SUM(rotten_egg_total) AS eggs, SUM(medal_total) AS medals,
            SUM(positive_opinion_total) AS positive, SUM(negative_opinion_total) AS negative,
            SUM(unique_participant_total) AS participants
       FROM artifact_totals`,
  );

  const [people] = await query<{ users: number; opinions: number; aggregates: number }>(
    `SELECT (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM opinions) AS opinions,
            (SELECT COUNT(*) FROM reaction_aggregates) AS aggregates`,
  );

  const stats: Stat[] = [
    { label: 'Rotten Eggs', value: Number(totals?.eggs ?? 0), mark: 'egg' as const, tone: 'egg' },
    { label: 'Medals', value: Number(totals?.medals ?? 0), mark: 'medal' as const, tone: 'medal' },
    { label: 'Critical opinions', value: Number(totals?.negative ?? 0) },
    { label: 'Appreciative opinions', value: Number(totals?.positive ?? 0) },
  ];

  return (
    <div className="space-y-8">
      <section aria-labelledby="totals-heading">
        <h2 id="totals-heading" className="mb-4 text-lg font-semibold text-primary">
          Across all published content
        </h2>
        <StatBlock stats={stats} />
        <p className="mt-3 text-xs text-tertiary">
          Reactions count taps. Opinions count people — one per person per artifact, never more.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section aria-labelledby="content-heading" className="panel rounded-[var(--radius-card)] p-5">
          <h2 id="content-heading" className="mb-4 text-lg font-semibold text-primary">
            Content
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link href="/admin/entities" className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] p-4 transition-colors hover:border-[var(--border-strong)]">
              <p className="text-2xl font-semibold numeric text-primary">
                {counts?.published_entities ?? 0}
                <span className="text-base font-medium text-tertiary"> / {counts?.entities ?? 0}</span>
              </p>
              <p className="mt-1 text-sm text-secondary">Profiles published</p>
            </Link>

            <Link href="/admin/flash-news" className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] p-4 transition-colors hover:border-[var(--border-strong)]">
              <p className="text-2xl font-semibold numeric text-primary">
                {counts?.published_flash_news ?? 0}
                <span className="text-base font-medium text-tertiary"> / {counts?.flash_news ?? 0}</span>
              </p>
              <p className="mt-1 text-sm text-secondary">Stories published</p>
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/admin/entities/new"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-primary px-4 py-2.5 text-sm font-medium text-ground transition-opacity duration-150 hover:opacity-90"
            >
              New Profile
            </Link>
            <Link
              href="/admin/flash-news/new"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-[var(--border-default)] px-4 py-2.5 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)]"
            >
              New Story
            </Link>
          </div>
        </section>

        <section aria-labelledby="environment-heading" className="panel rounded-[var(--radius-card)] p-5">
          <h2 id="environment-heading" className="mb-4 text-lg font-semibold text-primary">
            Environment
          </h2>
          <dl className="space-y-2.5 text-sm">
            {[
              ['Database', db.dialect],
              ['PIN hashing', pinAlgorithm()],
              ['Accounts', formatCount(Number(people?.users ?? 0))],
              ['Opinion rows', formatCount(Number(people?.opinions ?? 0))],
              ['Reaction aggregate rows', formatCount(Number(people?.aggregates ?? 0))],
              ['Unique participant total', formatCount(Number(totals?.participants ?? 0))],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-secondary">{label}</dt>
                <dd className="text-secondary">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
