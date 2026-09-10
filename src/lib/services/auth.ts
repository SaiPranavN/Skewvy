import { queryOne, execute } from '@/lib/db';
import { newId } from './crypto';
import { hashPin, verifyPin } from './pin';
import { issueAuthToken, consumeAuthToken, buildLinkUrl } from './auth-tokens';
import { sendVerificationEmail, sendPinResetEmail, sendStepUpEmail } from './email';
import { createSession, rotateSession, revokeAllSessionsForUser, isKnownDevice } from './sessions';
import { consumeRateLimit, RATE_RULES } from './rate-limit';
import type { PublicUser } from '@/lib/domain/types';

/**
 * Account lifecycle. Two rules shape every function here:
 *  1. No response ever reveals whether an email address has an account.
 *  2. Email is proof of ownership once; the PIN is the credential from then on.
 */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

interface UserRow {
  id: string;
  display_name: string;
  email: string;
  email_verified_at: string | null;
  pin_hash: string;
  pin_failed_attempts: number;
  pin_locked_until: string | null;
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

async function findByEmail(email: string): Promise<UserRow | null> {
  return queryOne<UserRow>('SELECT * FROM users WHERE email_normalized = $1', [normalizeEmail(email)]);
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  const row = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return row ? toPublicUser(row) : null;
}

/** Emails listed in ADMIN_EMAILS get the single admin flag on creation. */
function isAdminEmail(email: string): boolean {
  const allowed = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
  return allowed.includes(normalizeEmail(email));
}

export interface RegisterOptions {
  displayName: string;
  email: string;
  pin: string;
  ip?: string | null;
  redirectTo?: string | null;
}

/**
 * Always reports the same outcome. An address that already has a verified
 * account gets a "you already have an account" email rather than an error that
 * would confirm the address is registered.
 */
export async function registerAccount(options: RegisterOptions): Promise<{ status: 'verification_sent' }> {
  const existing = await findByEmail(options.email);
  const now = new Date().toISOString();

  if (existing?.email_verified_at) {
    const reset = await issueAuthToken(existing.id, 'pin_reset', { ip: options.ip });
    await sendPinResetEmail(
      existing.email,
      existing.display_name,
      buildLinkUrl('/auth/reset-pin', reset.token),
    );
    return { status: 'verification_sent' };
  }

  const pinHash = await hashPin(options.pin);
  let userId: string;

  if (existing) {
    // The account was never proven, so whoever verifies the inbox owns it.
    userId = existing.id;
    await execute(
      `UPDATE users SET display_name = $1, pin_hash = $2, pin_failed_attempts = 0,
              pin_locked_until = NULL, updated_at = $3 WHERE id = $4`,
      [options.displayName, pinHash, now, userId],
    );
  } else {
    userId = newId();
    await execute(
      `INSERT INTO users (id, display_name, email, email_normalized, pin_hash, is_admin, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [userId, options.displayName, options.email.trim(), normalizeEmail(options.email), pinHash, isAdminEmail(options.email) ? 1 : 0, now],
    );
  }

  const verification = await issueAuthToken(userId, 'email_verification', {
    ip: options.ip,
    redirectTo: options.redirectTo ?? null,
  });
  await sendVerificationEmail(
    options.email.trim(),
    options.displayName,
    buildLinkUrl('/auth/verify', verification.token, options.redirectTo),
  );

  return { status: 'verification_sent' };
}

export type VerifyResult =
  | { ok: true; user: PublicUser; redirectTo: string | null; sessionToken: string; expiresAt: string }
  | { ok: false; reason: 'not_found' | 'expired' | 'already_used' };

/** Consumes the verification link, marks the email verified and signs the person in. */
export async function verifyEmailToken(
  token: string,
  context: { userAgent?: string | null; ip?: string | null } = {},
): Promise<VerifyResult> {
  const consumed = await consumeAuthToken(token, 'email_verification');
  if (!consumed.ok) return { ok: false, reason: consumed.reason };

  const now = new Date().toISOString();
  await execute(
    `UPDATE users SET email_verified_at = COALESCE(email_verified_at, $1), pin_failed_attempts = 0,
            pin_locked_until = NULL, updated_at = $1 WHERE id = $2`,
    [now, consumed.userId],
  );

  const row = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [consumed.userId]);
  if (!row) return { ok: false, reason: 'not_found' };

  const session = await createSession({ userId: row.id, userAgent: context.userAgent, ip: context.ip });
  return {
    ok: true,
    user: toPublicUser(row),
    redirectTo: consumed.redirectTo,
    sessionToken: session.token,
    expiresAt: session.expiresAt,
  };
}

export async function resendVerification(email: string, ip?: string | null): Promise<void> {
  const user = await findByEmail(email);
  // Silent no-op for unknown or already verified addresses: nothing is revealed.
  if (!user || user.email_verified_at) return;

  const verification = await issueAuthToken(user.id, 'email_verification', { ip });
  await sendVerificationEmail(user.email, user.display_name, buildLinkUrl('/auth/verify', verification.token));
}

export type LoginOutcome =
  | { status: 'success'; user: PublicUser; sessionToken: string; expiresAt: string }
  | { status: 'invalid_credentials' }
  | { status: 'rate_limited'; retryAfterSeconds: number }
  | { status: 'verification_required' }
  | { status: 'step_up_required' };

const LOCKOUT_STEPS: Array<{ afterAttempts: number; seconds: number }> = [
  { afterAttempts: 10, seconds: 1800 },
  { afterAttempts: 7, seconds: 300 },
  { afterAttempts: 5, seconds: 60 },
];

function lockoutFor(attempts: number): string | null {
  const step = LOCKOUT_STEPS.find((candidate) => attempts >= candidate.afterAttempts);
  return step ? new Date(Date.now() + step.seconds * 1000).toISOString() : null;
}

/** A constant-cost comparison for unknown addresses, so timing cannot enumerate accounts. */
const DUMMY_HASH = '$scrypt$32768$YWJjZGVmZ2hpamtsbW5vcA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export interface LoginOptions {
  email: string;
  pin: string;
  previousSessionToken?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  redirectTo?: string | null;
}

export async function loginWithPin(options: LoginOptions): Promise<LoginOutcome> {
  const normalized = normalizeEmail(options.email);

  // Keyed on the address whether or not it exists, so lockout messaging leaks nothing.
  const attemptBudget = await consumeRateLimit(`login:email:${normalized}`, RATE_RULES.loginPerAccount);
  if (!attemptBudget.allowed) {
    return { status: 'rate_limited', retryAfterSeconds: attemptBudget.retryAfterSeconds };
  }

  const user = await findByEmail(options.email);
  if (!user) {
    await verifyPin(DUMMY_HASH, options.pin);
    return { status: 'invalid_credentials' };
  }

  if (user.pin_locked_until && new Date(user.pin_locked_until).getTime() > Date.now()) {
    return {
      status: 'rate_limited',
      retryAfterSeconds: Math.ceil((new Date(user.pin_locked_until).getTime() - Date.now()) / 1000),
    };
  }

  const valid = await verifyPin(user.pin_hash, options.pin);
  if (!valid) {
    const attempts = user.pin_failed_attempts + 1;
    await execute('UPDATE users SET pin_failed_attempts = $1, pin_locked_until = $2, updated_at = $3 WHERE id = $4', [
      attempts,
      lockoutFor(attempts),
      new Date().toISOString(),
      user.id,
    ]);
    return { status: 'invalid_credentials' };
  }

  await execute('UPDATE users SET pin_failed_attempts = 0, pin_locked_until = NULL, updated_at = $1 WHERE id = $2', [
    new Date().toISOString(),
    user.id,
  ]);

  if (!user.email_verified_at) {
    const verification = await issueAuthToken(user.id, 'email_verification', { ip: options.ip });
    await sendVerificationEmail(user.email, user.display_name, buildLinkUrl('/auth/verify', verification.token, options.redirectTo));
    return { status: 'verification_required' };
  }

  // Risk-based step-up: a device this account has never used needs one email confirmation.
  const known = await isKnownDevice(user.id, options.userAgent ?? null, options.ip ?? null);
  if (!known) {
    const stepUp = await issueAuthToken(user.id, 'step_up', { ip: options.ip, redirectTo: options.redirectTo ?? null });
    await sendStepUpEmail(user.email, user.display_name, buildLinkUrl('/auth/verify', stepUp.token, options.redirectTo));
    return { status: 'step_up_required' };
  }

  const session = await rotateSession(options.previousSessionToken ?? null, {
    userId: user.id,
    userAgent: options.userAgent,
    ip: options.ip,
  });

  return { status: 'success', user: toPublicUser(user), sessionToken: session.token, expiresAt: session.expiresAt };
}

/** Completes a step-up challenge and issues the session that login held back. */
export async function completeStepUp(
  token: string,
  context: { userAgent?: string | null; ip?: string | null } = {},
): Promise<VerifyResult> {
  const consumed = await consumeAuthToken(token, 'step_up');
  if (!consumed.ok) return { ok: false, reason: consumed.reason };

  const row = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [consumed.userId]);
  if (!row || !row.email_verified_at) return { ok: false, reason: 'not_found' };

  const session = await createSession({ userId: row.id, userAgent: context.userAgent, ip: context.ip });
  return {
    ok: true,
    user: toPublicUser(row),
    redirectTo: consumed.redirectTo,
    sessionToken: session.token,
    expiresAt: session.expiresAt,
  };
}

/** Always resolves the same way, whether or not the address has a verified account. */
export async function requestPinReset(email: string, ip?: string | null): Promise<void> {
  const user = await findByEmail(email);
  if (!user || !user.email_verified_at) return;

  const reset = await issueAuthToken(user.id, 'pin_reset', { ip });
  await sendPinResetEmail(user.email, user.display_name, buildLinkUrl('/auth/reset-pin', reset.token));
}

export type ResetPinOutcome =
  | { ok: true; user: PublicUser; sessionToken: string; expiresAt: string }
  | { ok: false; reason: 'not_found' | 'expired' | 'already_used' };

/** Sets a new PIN and signs every other device out. */
export async function resetPin(
  token: string,
  newPin: string,
  context: { userAgent?: string | null; ip?: string | null } = {},
): Promise<ResetPinOutcome> {
  const consumed = await consumeAuthToken(token, 'pin_reset');
  if (!consumed.ok) return { ok: false, reason: consumed.reason };

  const pinHash = await hashPin(newPin);
  const now = new Date().toISOString();
  await execute(
    `UPDATE users SET pin_hash = $1, pin_failed_attempts = 0, pin_locked_until = NULL,
            email_verified_at = COALESCE(email_verified_at, $2), updated_at = $2 WHERE id = $3`,
    [pinHash, now, consumed.userId],
  );
  await revokeAllSessionsForUser(consumed.userId);

  const row = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [consumed.userId]);
  if (!row) return { ok: false, reason: 'not_found' };

  const session = await createSession({ userId: row.id, userAgent: context.userAgent, ip: context.ip });
  return { ok: true, user: toPublicUser(row), sessionToken: session.token, expiresAt: session.expiresAt };
}
