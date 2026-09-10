import { query, queryOne, execute } from '@/lib/db';
import { generateToken, hashToken, hashIp, newId } from './crypto';
import type { PublicUser } from '@/lib/domain/types';

export const SESSION_COOKIE = 'skewvy_session';
/** Sessions last 30 days and slide forward whenever they are used. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SLIDING_REFRESH_AFTER_SECONDS = 60 * 60 * 24;

export interface SessionContext {
  sessionId: string;
  user: PublicUser;
}

interface UserRow {
  id: string;
  display_name: string;
  email: string;
  email_verified_at: string | null;
  is_admin: number;
  created_at: string;
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    emailVerifiedAt: row.email_verified_at,
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at,
  };
}

export interface CreateSessionOptions {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
}

/** Returns the raw token exactly once; only its hash is persisted. */
export async function createSession(options: CreateSessionOptions): Promise<{ token: string; expiresAt: string }> {
  const token = generateToken(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();

  await execute(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_used_at, device_metadata, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $5, $6, $7)`,
    [
      newId(),
      options.userId,
      hashToken(token),
      expiresAt,
      now.toISOString(),
      (options.userAgent ?? '').slice(0, 300) || null,
      hashIp(options.ip ?? null),
    ],
  );

  return { token, expiresAt };
}

/**
 * Session rotation after authentication: the old token is revoked and a fresh
 * one issued, so a token captured before login cannot be replayed after it.
 */
export async function rotateSession(
  previousToken: string | null,
  options: CreateSessionOptions,
): Promise<{ token: string; expiresAt: string }> {
  if (previousToken) await revokeSession(previousToken);
  return createSession(options);
}

export async function resolveSession(token: string | null | undefined): Promise<SessionContext | null> {
  if (!token) return null;

  const row = await queryOne<UserRow & { session_id: string; expires_at: string; last_used_at: string }>(
    `SELECT s.id AS session_id, s.expires_at, s.last_used_at,
            u.id, u.display_name, u.email, u.email_verified_at, u.is_admin, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL`,
    [hashToken(token)],
  );

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  // An unverified email must never carry a usable session.
  if (!row.email_verified_at) return null;

  const lastUsed = new Date(row.last_used_at).getTime();
  if (Date.now() - lastUsed > SLIDING_REFRESH_AFTER_SECONDS * 1000) {
    await touchSession(row.session_id);
  }

  return { sessionId: row.session_id, user: toPublicUser(row) };
}

async function touchSession(sessionId: string): Promise<void> {
  const now = new Date();
  await execute('UPDATE sessions SET last_used_at = $1, expires_at = $2 WHERE id = $3', [
    now.toISOString(),
    new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString(),
    sessionId,
  ]);
}

export async function revokeSession(token: string): Promise<void> {
  await execute('UPDATE sessions SET revoked_at = $1 WHERE token_hash = $2 AND revoked_at IS NULL', [
    new Date().toISOString(),
    hashToken(token),
  ]);
}

/** Used after a PIN reset: every existing session for the account is killed. */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await execute('UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL', [
    new Date().toISOString(),
    userId,
  ]);
}

export async function listActiveSessions(userId: string): Promise<
  Array<{ id: string; createdAt: string; lastUsedAt: string; expiresAt: string; deviceMetadata: string | null }>
> {
  const rows = await query<{
    id: string;
    created_at: string;
    last_used_at: string;
    expires_at: string;
    device_metadata: string | null;
  }>(
    `SELECT id, created_at, last_used_at, expires_at, device_metadata
       FROM sessions
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > $2
      ORDER BY last_used_at DESC`,
    [userId, new Date().toISOString()],
  );

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    deviceMetadata: row.device_metadata,
  }));
}

/**
 * Risk signal for step-up verification. A device fingerprint the account has
 * used before is trusted; anything else asks for one email confirmation.
 */
export async function isKnownDevice(userId: string, userAgent: string | null, ip: string | null): Promise<boolean> {
  const rows = await query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM sessions
      WHERE user_id = $1
        AND (device_metadata = $2 OR ip_hash = $3)`,
    [userId, (userAgent ?? '').slice(0, 300) || null, hashIp(ip)],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

export function sessionCookieOptions(expiresAt: string) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: new Date(expiresAt),
  };
}
