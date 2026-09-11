import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { listActiveSessions } from '@/lib/services/sessions';
import { query } from '@/lib/db';
import { formatCount } from '@/lib/domain/format';
import { RelativeTime, LocalDateTime } from '@/components/ui/TimeAgo';
import { StatBlock } from '@/components/ui/StatBlock';
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
    <div className="page-enter mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-10">
        <h1 className="text-[1.75rem] font-semibold tracking-[-0.025em] text-primary sm:text-[2rem]">
          {user.displayName}
        </h1>
        <p className="mt-2 text-sm text-secondary">
          {user.email} · joined <RelativeTime iso={user.createdAt} />
          {user.isAdmin && (
            <>
              {' · '}
              <Link href="/admin" className="text-secondary underline">
                Admin
              </Link>
            </>
          )}
        </p>
      </header>

      <section aria-labelledby="totals-heading" className="mb-12">
        <h2 id="totals-heading" className="sr-only">
          Your totals
        </h2>

        <StatBlock
          stats={[
            { label: 'Rotten Eggs sent', value: totalEggs, emoji: '🥚', tone: 'egg' },
            { label: 'Medals awarded', value: totalMedals, emoji: '🏅', tone: 'medal' },
            { label: 'Critical opinions', value: negativeOpinions },
            { label: 'Appreciative opinions', value: positiveOpinions },
          ]}
        />
        <p className="mt-4 text-xs text-tertiary">
          Reaction totals count every tap you sent. Opinion counts are the number of artifacts where you currently hold
          that position — one each.
        </p>
      </section>

      <section aria-labelledby="contributions-heading" className="mb-12">
        <h2 id="contributions-heading" className="mb-4 text-lg font-medium text-primary">
          What you have reacted to
        </h2>

        {contributions.length === 0 ? (
          <div className="panel p-8 text-center">
            <p className="text-sm text-secondary">
              Nothing yet.{' '}
              <Link href="/flash-news" className="text-secondary underline">
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
                  className="panel panel-interactive flex flex-wrap items-center gap-x-4 gap-y-2 p-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-primary">{row.title}</span>
                    <span className="eyebrow mt-0.5 block">
                      {row.artifact_type === 'entity' ? 'Entity' : 'Flash News'}
                    </span>
                  </span>

                  <span className="flex items-center gap-3 text-sm">
                    {Number(row.rotten_egg_count) > 0 && (
                      <span className="numeric font-medium text-egg">
                        {formatCount(Number(row.rotten_egg_count))} <span className="emoji">🥚</span>
                      </span>
                    )}
                    {Number(row.medal_count) > 0 && (
                      <span className="numeric font-medium text-medal">
                        {formatCount(Number(row.medal_count))} <span className="emoji">🏅</span>
                      </span>
                    )}
                  </span>

                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-secondary">
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${row.stance === 'negative' ? 'bg-egg' : 'bg-medal'}`}
                    />
                    {row.stance === 'negative' ? 'Critical' : 'Appreciative'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="security-heading" className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 id="security-heading" className="text-sm font-medium text-primary">
            Account security
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-secondary">Email verified</dt>
              <dd className="text-secondary">
                {user.emailVerifiedAt ? <LocalDateTime iso={user.emailVerifiedAt} /> : 'No'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-secondary">PIN hashing</dt>
              <dd className="text-secondary">{pinAlgorithm()}</dd>
            </div>
          </dl>
          <Link
            href="/auth/reset-pin"
            className="mt-5 inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-[var(--border-default)] px-4 py-2.5 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)]"
          >
            Change my PIN
          </Link>
        </div>

        <div className="panel p-5">
          <h2 className="text-sm font-medium text-primary">Active sessions</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {sessions.slice(0, 5).map((session) => (
              <li key={session.id} className="border-b border-[var(--border-subtle)] pb-3 last:border-0 last:pb-0">
                <p className="truncate text-secondary">{session.deviceMetadata ?? 'Unknown device'}</p>
                <p className="mt-0.5 text-xs text-tertiary">
                  Last used <RelativeTime iso={session.lastUsedAt} /> · expires{' '}
                  <RelativeTime iso={session.expiresAt} />
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-tertiary">
            Resetting your PIN signs out every session listed here.
          </p>
        </div>
      </section>
    </div>
  );
}
