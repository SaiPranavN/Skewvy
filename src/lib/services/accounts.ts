import { query, queryOne, execute } from '@/lib/db';
import { revokeAllSessionsForUser } from './sessions';
import { recomputeTotals } from './totals';
import { rebuildTimelineFor } from './timeline';

/**
 * Account administration.
 *
 * Two outcomes, and they are not variations of each other. **Suspending** locks
 * someone out and keeps everything they wrote — reversible, and the right answer
 * almost always. **Deleting** removes the person and every reaction, opinion and
 * comment they left, which the counters then have to be rebuilt to reflect.
 */

export interface AccountSummary {
  id: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  emailVerifiedAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  reactionCount: number;
  opinionCount: number;
  commentCount: number;
}

export interface AccountPage {
  accounts: AccountSummary[];
  total: number;
  nextOffset: number | null;
}

interface AccountRow {
  id: string;
  display_name: string;
  email: string;
  is_admin: number;
  email_verified_at: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  last_seen_at: string | null;
  reaction_count: number | null;
  opinion_count: number | null;
  comment_count: number | null;
}

export async function listAccounts(
  options: { search?: string | null; limit?: number; offset?: number } = {},
): Promise<AccountPage> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);
  const search = options.search?.trim().toLowerCase() ?? '';
  const like = `%${search}%`;

  // An empty search must not filter anything out, so the clause is skipped
  // rather than matched against '%%' — which would exclude a NULL name.
  const where = search ? 'WHERE (LOWER(u.display_name) LIKE $1 OR u.email_normalized LIKE $1)' : '';
  const params = search ? [like] : [];

  const rows = await query<AccountRow>(
    `SELECT u.id, u.display_name, u.email, u.is_admin, u.email_verified_at,
            u.suspended_at, u.suspended_reason, u.created_at,
            (SELECT MAX(last_used_at) FROM sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL) AS last_seen_at,
            (SELECT COALESCE(SUM(rotten_egg_count + medal_count), 0) FROM reaction_aggregates r WHERE r.user_id = u.id) AS reaction_count,
            (SELECT COUNT(*) FROM opinions o WHERE o.user_id = u.id) AS opinion_count,
            (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id AND c.deleted_at IS NULL) AS comment_count
       FROM users u
       ${where}
      ORDER BY u.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  const totalRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM users u ${where}`,
    params,
  );
  const total = Number(totalRow?.total ?? 0);

  return {
    accounts: rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      isAdmin: Number(row.is_admin) === 1,
      emailVerifiedAt: row.email_verified_at,
      suspendedAt: row.suspended_at,
      suspendedReason: row.suspended_reason,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      reactionCount: Number(row.reaction_count ?? 0),
      opinionCount: Number(row.opinion_count ?? 0),
      commentCount: Number(row.comment_count ?? 0),
    })),
    total,
    nextOffset: offset + rows.length < total ? offset + rows.length : null,
  };
}

export type AccountActionOutcome = 'done' | 'not_found' | 'refused_self' | 'refused_admin';

/**
 * Locks an account out without destroying anything.
 *
 * Sessions are revoked in the same breath: leaving a live session open would
 * mean a suspended person stays signed in until it expired, which is not what
 * anyone means by suspended.
 */
export async function suspendAccount(input: {
  userId: string;
  actingAdminId: string;
  reason?: string | null;
}): Promise<AccountActionOutcome> {
  const target = await queryOne<{ id: string; is_admin: number }>('SELECT id, is_admin FROM users WHERE id = $1', [
    input.userId,
  ]);
  if (!target) return 'not_found';
  if (target.id === input.actingAdminId) return 'refused_self';
  if (Number(target.is_admin) === 1) return 'refused_admin';

  const now = new Date().toISOString();
  await execute('UPDATE users SET suspended_at = $2, suspended_reason = $3, updated_at = $2 WHERE id = $1', [
    input.userId,
    now,
    input.reason?.trim() || null,
  ]);
  await revokeAllSessionsForUser(input.userId);
  return 'done';
}

export async function restoreAccount(userId: string): Promise<AccountActionOutcome> {
  const target = await queryOne<{ id: string }>('SELECT id FROM users WHERE id = $1', [userId]);
  if (!target) return 'not_found';

  await execute('UPDATE users SET suspended_at = NULL, suspended_reason = NULL, updated_at = $2 WHERE id = $1', [
    userId,
    new Date().toISOString(),
  ]);
  return 'done';
}

/**
 * Removes an account and everything it contributed.
 *
 * Foreign keys cascade the reactions, opinions and comments away, but
 * `artifact_totals` is denormalised and the timeline is a rollup — neither
 * notices. Both are rebuilt for the artifacts this person touched, so the
 * public numbers still add up and the chart still ends on the figure printed
 * beside it. Which artifacts those are has to be read *before* the delete.
 */
export async function deleteAccount(input: {
  userId: string;
  actingAdminId: string;
}): Promise<AccountActionOutcome> {
  const target = await queryOne<{ id: string; is_admin: number }>('SELECT id, is_admin FROM users WHERE id = $1', [
    input.userId,
  ]);
  if (!target) return 'not_found';
  if (target.id === input.actingAdminId) return 'refused_self';
  if (Number(target.is_admin) === 1) return 'refused_admin';

  const touched = await query<{ artifact_type: string; artifact_id: string }>(
    `SELECT DISTINCT artifact_type, artifact_id FROM reaction_aggregates WHERE user_id = $1
     UNION
     SELECT DISTINCT artifact_type, artifact_id FROM opinions WHERE user_id = $1`,
    [input.userId],
  );

  await execute('DELETE FROM users WHERE id = $1', [input.userId]);

  for (const row of touched) {
    const artifactType = row.artifact_type as 'entity' | 'flash_news';
    await rebuildTimelineFor(artifactType, row.artifact_id);
    await recomputeTotals(artifactType, row.artifact_id);
  }

  return 'done';
}

/** True while the account is locked out. Read on every session resolution. */
export async function accountIsSuspended(userId: string): Promise<boolean> {
  const row = await queryOne<{ suspended_at: string | null }>('SELECT suspended_at FROM users WHERE id = $1', [userId]);
  return Boolean(row?.suspended_at);
}
