import { queryOne, execute } from '@/lib/db';
import { generateToken, hashToken, hashIp, newId } from './crypto';
import { normalizeEmail } from './auth';
import { sendVerificationEmail } from './email';
import { buildLinkUrl } from './auth-tokens';
import { requiresEmailVerification } from './auth';
import { POLICY_VERSIONS } from '@/lib/legal';

/**
 * Two-step sign-up: prove the address, then choose the PIN.
 *
 * Nothing is written to `users` until the link in the email has been opened.
 * That ordering is the point: a sign-up with somebody else's address creates no
 * account for them to reclaim, an abandoned one leaves the address free, and a
 * PIN is never stored for an address nobody has shown they control.
 *
 * The pending row holds only a name, an address and a hashed token. The PIN
 * arrives at the second step and is hashed straight into the account.
 */

const TTL_SECONDS = 60 * 60;

export interface BeginRegistrationOptions {
  displayName: string;
  email: string;
  ip?: string | null;
  redirectTo?: string | null;
}

export type BeginRegistrationResult =
  /** The link is on its way. Said whether or not an account already existed. */
  | { status: 'verification_sent' }
  /**
   * No mail transport configured, so there is no inbox to send anyone to and
   * the second step is handed back directly. `requiresEmailVerification()`
   * is unconditionally true in production, so this cannot happen on a live
   * deployment.
   */
  | { status: 'ready_for_pin'; token: string }
  | { status: 'account_exists' }
  /** The row is written but the link never left the building. */
  | { status: 'delivery_failed'; detail: string };

export async function beginRegistration(
  options: BeginRegistrationOptions,
): Promise<BeginRegistrationResult> {
  const email = options.email.trim();
  const normalized = normalizeEmail(email);
  const now = new Date();

  const existing = await queryOne<{ id: string; email_verified_at: string | null }>(
    'SELECT id, email_verified_at FROM users WHERE email_normalized = $1',
    [normalized],
  );

  if (existing?.email_verified_at) {
    // A proven account already owns this address. Sending a fresh sign-up link
    // would do nothing useful; the honest answer is to point at signing in.
    return { status: 'account_exists' };
  }

  /*
   * Only one sign-up may be in flight per address. Retiring the previous one
   * means an older email in the inbox stops working the moment a new one is
   * requested, so a link that leaked cannot be used behind the person's back.
   */
  await execute(
    'UPDATE pending_registrations SET consumed_at = $1 WHERE email_normalized = $2 AND consumed_at IS NULL',
    [now.toISOString(), normalized],
  );

  const token = generateToken(32);
  await execute(
    `INSERT INTO pending_registrations
       (id, display_name, email, email_normalized, token_hash, expires_at, created_at, requested_ip_hash, redirect_to,
        terms_version, privacy_version, policies_accepted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $7)`,
    [
      newId(),
      options.displayName.trim(),
      email,
      normalized,
      hashToken(token),
      new Date(now.getTime() + TTL_SECONDS * 1000).toISOString(),
      now.toISOString(),
      hashIp(options.ip ?? null),
      options.redirectTo ?? null,
      // Clicking Continue under the notice is the acceptance; these are the
      // versions that notice linked to.
      POLICY_VERSIONS.terms,
      POLICY_VERSIONS.privacy,
    ],
  );

  if (!requiresEmailVerification()) {
    return { status: 'ready_for_pin', token };
  }

  /*
   * A delivery failure has to be reported, not swallowed. Sign-up now depends
   * entirely on that email arriving, so "check your inbox" for a message that
   * was never accepted leaves someone waiting on nothing — and an unhandled
   * throw here turns the whole sign-up into a 500 with no explanation.
   */
  try {
    await sendVerificationEmail(
      email,
      options.displayName.trim(),
      buildLinkUrl('/auth/complete', token, options.redirectTo),
    );
  } catch (error) {
    return { status: 'delivery_failed', detail: (error as Error).message };
  }

  return { status: 'verification_sent' };
}

export interface PendingRegistration {
  displayName: string;
  email: string;
  redirectTo: string | null;
  termsVersion: string | null;
  privacyVersion: string | null;
  policiesAcceptedAt: string | null;
}

export type PendingLookup =
  | { ok: true; pending: PendingRegistration }
  | { ok: false; reason: 'not_found' | 'expired' | 'already_used' };

/** Reads a pending sign-up without consuming it, so the PIN form can render. */
export async function findPendingRegistration(token: string): Promise<PendingLookup> {
  const row = await queryOne<{
    display_name: string;
    email: string;
    expires_at: string;
    consumed_at: string | null;
    redirect_to: string | null;
    terms_version: string | null;
    privacy_version: string | null;
    policies_accepted_at: string | null;
  }>(
    `SELECT display_name, email, expires_at, consumed_at, redirect_to, terms_version, privacy_version, policies_accepted_at
       FROM pending_registrations WHERE token_hash = $1`,
    [hashToken(token)],
  );

  if (!row) return { ok: false, reason: 'not_found' };
  if (row.consumed_at) return { ok: false, reason: 'already_used' };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { ok: false, reason: 'expired' };

  return {
    ok: true,
    pending: {
      displayName: row.display_name,
      email: row.email,
      redirectTo: row.redirect_to,
      termsVersion: row.terms_version,
      privacyVersion: row.privacy_version,
      policiesAcceptedAt: row.policies_accepted_at,
    },
  };
}

/**
 * Burns the token and hands back the details it was holding.
 *
 * The update is conditional on the row still being unconsumed, so two requests
 * racing on the same link produce one account rather than two.
 */
export async function claimPendingRegistration(token: string): Promise<PendingLookup> {
  const lookup = await findPendingRegistration(token);
  if (!lookup.ok) return lookup;

  const now = new Date().toISOString();
  const claimed = await queryOne<{ id: string }>(
    `UPDATE pending_registrations SET consumed_at = $1
      WHERE token_hash = $2 AND consumed_at IS NULL
      RETURNING id`,
    [now, hashToken(token)],
  );

  return claimed ? lookup : { ok: false, reason: 'already_used' };
}

/** Clears sign-ups that were never completed. */
export async function prunePendingRegistrations(olderThanHours = 48): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanHours * 3_600_000).toISOString();
  await execute('DELETE FROM pending_registrations WHERE created_at < $1', [cutoff]);
}
