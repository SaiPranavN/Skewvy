import Link from 'next/link';
import type { Metadata } from 'next';
import { query } from '@/lib/db';
import { formatCount } from '@/lib/domain/format';
import { SimulatorControls } from '@/components/admin/SimulatorControls';
import { simulatorAllowed, simulatorEnabled, simulatorRunning } from '@/lib/services/simulator';
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

  const enabled = await simulatorEnabled();

  const stats = [
    { label: 'Rotten Eggs', value: Number(totals?.eggs ?? 0), emoji: '🥚', tone: 'text-egg' },
    { label: 'Medals', value: Number(totals?.medals ?? 0), emoji: '🏅', tone: 'text-medal' },
    { label: 'Negative opinions', value: Number(totals?.negative ?? 0), emoji: '⚖️', tone: 'text-chalk' },
    { label: 'Positive opinions', value: Number(totals?.positive ?? 0), emoji: '⚖️', tone: 'text-chalk' },
  ];

  return (
    <div className="space-y-8">
      <section aria-labelledby="totals-heading">
        <h2 id="totals-heading" className="mb-4 text-lg font-bold text-chalk">
          Across all published content
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="glass rounded-[var(--radius-card)] p-5">
              <span className="emoji text-xl" aria-hidden="true">
                {stat.emoji}
              </span>
              <p className={`mt-2 text-3xl font-bold tabular ${stat.tone}`}>{formatCount(stat.value)}</p>
              <p className="mt-1 text-xs text-haze">{stat.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-haze-dim">
          Reactions count taps. Opinions count people — one per person per artifact, never more.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section aria-labelledby="content-heading" className="glass rounded-[var(--radius-card)] p-5">
          <h2 id="content-heading" className="mb-4 text-lg font-bold text-chalk">
            Content
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link href="/admin/entities" className="rounded-2xl border border-white/10 p-4 transition-colors hover:border-white/25">
              <p className="text-2xl font-bold tabular text-chalk">
                {counts?.published_entities ?? 0}
                <span className="text-base font-medium text-haze-dim"> / {counts?.entities ?? 0}</span>
              </p>
              <p className="mt-1 text-sm text-haze">Entities published</p>
            </Link>

            <Link href="/admin/flash-news" className="rounded-2xl border border-white/10 p-4 transition-colors hover:border-white/25">
              <p className="text-2xl font-bold tabular text-chalk">
                {counts?.published_flash_news ?? 0}
                <span className="text-base font-medium text-haze-dim"> / {counts?.flash_news ?? 0}</span>
              </p>
              <p className="mt-1 text-sm text-haze">Flash News published</p>
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/admin/entities/new"
              className="rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-bright"
            >
              New Entity
            </Link>
            <Link
              href="/admin/flash-news/new"
              className="rounded-full border border-white/14 px-4 py-2.5 text-sm font-medium text-chalk-dim transition-colors hover:border-white/30"
            >
              New Flash News
            </Link>
          </div>
        </section>

        <section aria-labelledby="environment-heading" className="glass rounded-[var(--radius-card)] p-5">
          <h2 id="environment-heading" className="mb-4 text-lg font-bold text-chalk">
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
                <dt className="text-haze">{label}</dt>
                <dd className="text-chalk-dim">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <SimulatorControls
        allowed={simulatorAllowed()}
        enabled={enabled}
        running={simulatorRunning()}
      />
    </div>
  );
}
