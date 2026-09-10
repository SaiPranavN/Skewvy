import { queryOne, execute } from '@/lib/db';
import { generateToken, hashToken, hashIp, newId } from './crypto';

export type AuthTokenType = 'email_verification' | 'pin_reset' | 'step_up';

const TTL_SECONDS: Record<AuthTokenType, number> = {
  email_verification: 60 * 60,
  pin_reset: 30 * 60,
  step_up: 30 * 60,
};

export interface IssuedToken {
  /** The raw value that goes in the emailed link. Never persisted. */
  token: string;
  expiresAt: string;
}

/**
 * Issues a one-time link token. Any outstanding token of the same type is
 * consumed first, so an older email in the inbox stops working immediately.
 */
export async function issueAuthToken(
  userId: string,
  tokenType: AuthTokenType,
  options: { ip?: string | null; redirectTo?: string | null } = {},
): Promise<IssuedToken> {
  const now = new Date();
  await execute(
    `UPDATE auth_tokens SET consumed_at = $1
      WHERE user_id = $2 AND token_type = $3 AND consumed_at IS NULL`,
    [now.toISOString(), userId, tokenType],
  );

  const token = generateToken(32);
  const expiresAt = new Date(now.getTime() + TTL_SECONDS[tokenType] * 1000).toISOString();

  await execute(
    `INSERT INTO auth_tokens (id, user_id, token_hash, token_type, expires_at, created_at, requested_ip_hash, redirect_to)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [newId(), userId, hashToken(token), tokenType, expiresAt, now.toISOString(), hashIp(options.ip ?? null), options.redirectTo ?? null],
  );

  return { token, expiresAt };
}

export type ConsumeFailure = 'not_found' | 'expired' | 'already_used';

export type ConsumeResult =
  | { ok: true; userId: string; redirectTo: string | null }
  | { ok: false; reason: ConsumeFailure };

/** Verifies and burns a token in one step; a second call always fails. */
export async function consumeAuthToken(token: string, tokenType: AuthTokenType): Promise<ConsumeResult> {
  const row = await queryOne<{ id: string; user_id: string; expires_at: string; consumed_at: string | null; redirect_to: string | null }>(
    'SELECT id, user_id, expires_at, consumed_at, redirect_to FROM auth_tokens WHERE token_hash = $1 AND token_type = $2',
    [hashToken(token), tokenType],
  );

  if (!row) return { ok: false, reason: 'not_found' };
  if (row.consumed_at) return { ok: false, reason: 'already_used' };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { ok: false, reason: 'expired' };

  const result = await execute(
    'UPDATE auth_tokens SET consumed_at = $1 WHERE id = $2 AND consumed_at IS NULL',
    [new Date().toISOString(), row.id],
  );
  void result;

  return { ok: true, userId: row.user_id, redirectTo: row.redirect_to };
}

export function buildLinkUrl(pathname: string, token: string, redirectTo?: string | null): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
  const url = new URL(pathname, `${base}/`);
  url.searchParams.set('token', token);
  if (redirectTo) url.searchParams.set('redirectTo', redirectTo);
  return url.toString();
}
