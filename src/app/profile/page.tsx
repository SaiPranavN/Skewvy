import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { listActiveSessions } from '@/lib/services/sessions';
import { query } from '@/lib/db';
import { formatCount } from '@/lib/domain/format';
import { RelativeTime, LocalDateTime } from '@/components/ui/TimeAgo';
import { pinAlgorithm } from '@/lib/services/pin';

export const metadata: Metadata = { title: 'Your profile' };
export const dynamic = 'force-dynamic';

interface ContributionRow {
  artifact_type: string;
  rotten_egg_count: number;
  medal_count: number;
  stance: string | null;
  title: string;
  slug: string;
  updated_at: string;
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirectTo=%2Fprofile');

  // The viewer's own aggregates, joined to whichever content table they point at.
  const contributions = await query<ContributionRow>(
    `SELECT a.artifact_type, a.rotten_egg_count, a.medal_count, a.updated_at,
            o.stance,
            COALESCE(e.name, f.headline) AS title,
            COALESCE(e.slug, f.slug) AS slug
       FROM reaction_aggregates a
       LEFT JOIN entities e ON a.artifact_type = 'entity' AND e.id = a.artifact_id
       LEFT JOIN flash_news f ON a.artifact_type = 'flash_news' AND f.id = a.artifact_id
       LEFT JOIN opinions o ON o.user_id = a.user_id AND o.artifact_type = a.artifact_type AND o.artifact_id = a.artifact_id
      WHERE a.user_id = $1
      ORDER BY a.updated_at DESC
      LIMIT 50`,
    [user.id],
  );

  const sessions = await listActiveSessions(user.id);

  const totalEggs = contributions.reduce((sum, row) => sum + Number(row.rotten_egg_count), 0);
  const totalMedals = contributions.reduce((sum, row) => sum + Number(row.medal_count), 0);
  const negativeOpinions = contributions.filter((row) => row.stance === 'negative').length;
  const positiveOpinions = contributions.filter((row) => row.stance === 'positive').length;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <header className="mb-10">
        <p className="label-caps mb-3 text-brand-bright">Your record</p>
        <h1 className="text-balance text-4xl font-black leading-tight tracking-[-0.03em] text-chalk sm:text-5xl">
          {user.displayName}
        </h1>
        <p className="mt-3 text-sm text-haze">
          {user.email} · joined <RelativeTime iso={user.createdAt} />
          {user.isAdmin && (
            <>
              {' · '}
              <Link href="/admin" className="text-chalk-dim underline">
                Admin
              </Link>
            </>
          )}
        </p>
      </header>

      <section aria-labelledby="totals-heading" className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <h2 id="totals-heading" className="sr-only">
          Your totals
        </h2>

        {[
          { label: 'Rotten Eggs sent', value: totalEggs, emoji: '🥚', tone: 'text-egg' },
          { label: 'Medals given', value: totalMedals, emoji: '🏅', tone: 'text-medal' },
          { label: 'Frustrated opinions', value: negativeOpinions, emoji: '⚖️', tone: 'text-chalk' },
          { label: 'Appreciative opinions', value: positiveOpinions, emoji: '⚖️', tone: 'text-chalk' },
        ].map((item) => (
          <div key={item.label} className="glass rounded-[var(--radius-card)] p-5">
            <span className="emoji text-xl" aria-hidden="true">
              {item.emoji}
            </span>
            <p className={`mt-2 text-3xl font-bold tabular ${item.tone}`}>{formatCount(item.value)}</p>
            <p className="mt-1 text-xs text-haze">{item.label}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="contributions-heading" className="mb-12">
        <h2 id="contributions-heading" className="mb-4 text-xl font-bold text-chalk">
          What you have reacted to
        </h2>

        {contributions.length === 0 ? (
          <div className="glass rounded-[var(--radius-card)] p-8 text-center">
            <p className="text-sm text-haze">
              Nothing yet.{' '}
              <Link href="/flash-news" className="text-chalk-dim underline">
                Find something worth reacting to.
              </Link>
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {contributions.map((row) => (
              <li key={`${row.artifact_type}:${row.slug}`}>
                <Link
                  href={row.artifact_type === 'entity' ? `/entities/${row.slug}` : `/flash-news/${row.slug}`}
                  className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl p-4 transition-colors hover:border-white/25"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-chalk">{row.title}</span>
                    <span className="mt-0.5 block text-[0.6875rem] uppercase tracking-[0.12em] text-haze-dim">
                      {row.artifact_type === 'entity' ? 'Entity' : 'Flash News'}
                    </span>
                  </span>

                  <span className="flex items-center gap-3 text-sm">
                    {Number(row.rotten_egg_count) > 0 && (
                      <span className="font-semibold text-egg">
                        {formatCount(Number(row.rotten_egg_count))} <span className="emoji">🥚</span>
                      </span>
                    )}
                    {Number(row.medal_count) > 0 && (
                      <span className="font-semibold text-medal">
                        {formatCount(Number(row.medal_count))} <span className="emoji">🏅</span>
                      </span>
                    )}
                  </span>

                  <span
                    className={`rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold ${
                      row.stance === 'negative' ? 'bg-egg/14 text-egg' : 'bg-medal/14 text-medal'
                    }`}
                  >
                    {row.stance === 'negative' ? 'Frustrated' : 'Appreciative'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="security-heading" className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-[var(--radius-card)] p-5">
          <h2 id="security-heading" className="text-lg font-bold text-chalk">
            Account security
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-haze">Email verified</dt>
              <dd className="text-chalk-dim">
                {user.emailVerifiedAt ? <LocalDateTime iso={user.emailVerifiedAt} /> : 'No'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-haze">PIN hashing</dt>
              <dd className="text-chalk-dim">{pinAlgorithm()}</dd>
            </div>
          </dl>
          <Link
            href="/auth/reset-pin"
            className="mt-5 inline-block rounded-xl border border-white/14 px-4 py-2.5 text-sm font-medium text-chalk-dim transition-colors hover:border-white/30"
          >
            Change my PIN
          </Link>
        </div>

        <div className="glass rounded-[var(--radius-card)] p-5">
          <h2 className="text-lg font-bold text-chalk">Active sessions</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {sessions.slice(0, 5).map((session) => (
              <li key={session.id} className="border-b border-white/6 pb-3 last:border-0 last:pb-0">
                <p className="truncate text-chalk-dim">{session.deviceMetadata ?? 'Unknown device'}</p>
                <p className="mt-0.5 text-xs text-haze-dim">
                  Last used <RelativeTime iso={session.lastUsedAt} /> · expires{' '}
                  <RelativeTime iso={session.expiresAt} />
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-haze-dim">
            Resetting your PIN signs out every session listed here.
          </p>
        </div>
      </section>
    </div>
  );
}
