import { queryOne, execute } from '@/lib/db';
import { newId } from './crypto';
import { hashPin, verifyPin } from './pin';
import { issueAuthToken, consumeAuthToken, buildLinkUrl } from './auth-tokens';
import { sendVerificationEmail, sendPinResetEmail, sendStepUpEmail, emailDeliveryConfigured } from './email';
import { createSession, rotateSession, revokeAllSessionsForUser, isKnownDevice } from './sessions';
import { consumeRateLimit, RATE_RULES } from './rate-limit';
import type { PublicUser } from '@/lib/domain/types';

/**
 * Account lifecycle. Three rules shape every function here:
 *  1. No response ever reveals whether an email address has an account.
 *  2. Email is proof of ownership once; the PIN is the credential from then on.
 *  3. Email is never *required* unless this deployment can actually send it.
 */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Whether sign-up and risk-based step-up require an email round trip.
 *
 * The default follows capability rather than ceremony: a deployment with no
 * mail transport cannot ask anyone to open a link, so it signs people in
 * directly. Production always requires it, and `REQUIRE_EMAIL_VERIFICATION`
 * forces the answer either way.
 *
 *   REQUIRE_EMAIL_VERIFICATION=1  always require it
 *   REQUIRE_EMAIL_VERIFICATION=0  never require it (refused in production)
 *   unset                         require it in production, or once
 *                                 RESEND_API_KEY is configured
 */
export function requiresEmailVerification(): boolean {
  const override = process.env.REQUIRE_EMAIL_VERIFICATION?.trim();
  if (override === '1') return true;
  if (override === '0' && process.env.NODE_ENV !== 'production') return false;
  if (process.env.NODE_ENV === 'production') return true;
  return emailDeliveryConfigured();
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
  userAgent?: string | null;
  redirectTo?: string | null;
}

/**
 * Always reports the same outcome for a given configuration. An address that
 * already has a verified account gets a "you already have an account" email
 * rather than an error that would confirm the address is registered.
 */
export type RegisterResult =
  | { status: 'verification_sent' }
  | { status: 'account_exists' }
  | { status: 'ready_for_pin'; token: string }
  | { status: 'delivery_failed'; detail: string };

/**
 * Step one of sign-up: a name and an address, nothing more.
 *
 * No account is created here. See `registration.ts` — the row that is written
 * holds only what the second step needs, and `users` is not touched until the
 * emailed link has been opened.
 */
export async function registerAccount(options: {
  displayName: string;
  email: string;
  ip?: string | null;
  redirectTo?: string | null;
}): Promise<RegisterResult> {
  const { beginRegistration } = await import('./registration');
  return beginRegistration(options);
}

export type CompleteRegistrationResult =
  | { status: 'signed_in'; user: PublicUser; sessionToken: string; expiresAt: string; redirectTo: string | null }
  | { status: 'link_invalid'; reason: 'not_found' | 'expired' | 'already_used' }
  | { status: 'account_exists' };

/**
 * Step two: the address is proven, so now the account is made.
 *
 * The email is marked verified at creation rather than afterwards — opening the
 * link is what proved it, and this row would not exist otherwise.
 */
export async function completeRegistration(options: {
  token: string;
  pin: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<CompleteRegistrationResult> {
  const { claimPendingRegistration } = await import('./registration');

  const claimed = await claimPendingRegistration(options.token);
  if (!claimed.ok) return { status: 'link_invalid', reason: claimed.reason };

  const { displayName, email, redirectTo } = claimed.pending;
  const normalized = normalizeEmail(email);
  const now = new Date().toISOString();
  const pinHash = await hashPin(options.pin);

  const existing = await queryOne<UserRow>('SELECT * FROM users WHERE email_normalized = $1', [normalized]);

  if (existing?.email_verified_at) {
    // Someone completed sign-up for this address between the link being sent
    // and it being opened. The account is theirs; this link does nothing.
    return { status: 'account_exists' };
  }

  let userId: string;
  if (existing) {
    // An unproven row from the older single-step flow. Opening the link proves
    // the address, so whoever did it owns the account.
    userId = existing.id;
    await execute(
      `UPDATE users SET display_name = $1, pin_hash = $2, email_verified_at = $3,
              pin_failed_attempts = 0, pin_locked_until = NULL, updated_at = $3 WHERE id = $4`,
      [displayName, pinHash, now, userId],
    );
  } else {
    userId = newId();
    await execute(
      `INSERT INTO users (id, display_name, email, email_normalized, pin_hash, email_verified_at, is_admin, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $6)`,
      [userId, displayName, email, normalized, pinHash, now, isAdminEmail(email) ? 1 : 0],
    );
  }

  const row = (await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [userId]))!;
  const session = await createSession({ userId, userAgent: options.userAgent, ip: options.ip });

  return {
    status: 'signed_in',
    user: toPublicUser(row),
    sessionToken: session.token,
    expiresAt: session.expiresAt,
    redirectTo,
  };
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
  const normalized = normalizeEmail(email);

  /*
   * A sign-up waiting on its email has no row in `users` yet, so the pending
   * table is the first place to look. Starting it again issues a fresh token
   * and retires the previous one, which is what makes the newest link in an
   * inbox the only one that works.
   */
  const pending = await queryOne<{ display_name: string; email: string }>(
    `SELECT display_name, email FROM pending_registrations
      WHERE email_normalized = $1 AND consumed_at IS NULL
      ORDER BY created_at DESC`,
    [normalized],
  );

  if (pending) {
    const { beginRegistration } = await import('./registration');
    await beginRegistration({ displayName: pending.display_name, email: pending.email, ip });
    return;
  }

  // An unproven account from the older single-step flow.
  const user = await findByEmail(email);
  // Silent no-op for unknown or already verified addresses: nothing is revealed.
  if (!user || user.email_verified_at) return;

  const verification = await issueAuthToken(user.id, 'email_verification', { ip });
  await sendVerificationEmail(user.email, user.display_name, buildLinkUrl('/auth/verify', verification.token));
}

export type LoginOutcome =
  | { status: 'success'; user: PublicUser; sessionToken: string; expiresAt: string }
  | { status: 'suspended'; reason: string | null }
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

  /*
   * Checked only after the PIN has been proved correct. Answering "suspended"
   * to anyone who guesses an address would turn this into a way to find out
   * which addresses have accounts.
   */
  const suspension = await queryOne<{ suspended_at: string | null; suspended_reason: string | null }>(
    'SELECT suspended_at, suspended_reason FROM users WHERE id = $1',
    [user.id],
  );
  if (suspension?.suspended_at) {
    return { status: 'suspended', reason: suspension.suspended_reason };
  }

  if (!user.email_verified_at && requiresEmailVerification()) {
    const verification = await issueAuthToken(user.id, 'email_verification', { ip: options.ip });
    await sendVerificationEmail(user.email, user.display_name, buildLinkUrl('/auth/verify', verification.token, options.redirectTo));
    return { status: 'verification_required' };
  }

  // Risk-based step-up: a device this account has never used needs one email
  // confirmation — but only where we can actually deliver that email.
  const known = !requiresEmailVerification() || (await isKnownDevice(user.id, options.userAgent ?? null, options.ip ?? null));
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

/**
 * Starts a PIN reset.
 *
 * With a mail transport, this emails a one-time link and always resolves the
 * same way whether or not the address has a verified account. Without one there
 * is no link to send, so the caller is told to collect the new PIN directly —
 * otherwise anyone who forgot a PIN would be locked out permanently, with no
 * inbox and no way back in.
 */
export type PinResetRequestOutcome = { mode: 'emailed' } | { mode: 'set_directly' };

export async function requestPinReset(email: string, ip?: string | null): Promise<PinResetRequestOutcome> {
  if (!requiresEmailVerification()) return { mode: 'set_directly' };

  const user = await findByEmail(email);
  if (user?.email_verified_at) {
    const reset = await issueAuthToken(user.id, 'pin_reset', { ip });
    await sendPinResetEmail(user.email, user.display_name, buildLinkUrl('/auth/reset-pin', reset.token));
  }
  return { mode: 'emailed' };
}

export type DirectResetOutcome =
  | { ok: true; user: PublicUser; sessionToken: string; expiresAt: string }
  | { ok: false; reason: 'not_found' | 'not_permitted' };

/**
 * Sets a new PIN from the address alone, for deployments with no mail
 * transport. Refused outright the moment email verification is required, so a
 * live deployment can never reset a PIN without proving inbox ownership.
 */
export async function resetPinWithoutEmail(
  email: string,
  newPin: string,
  context: { userAgent?: string | null; ip?: string | null } = {},
): Promise<DirectResetOutcome> {
  if (requiresEmailVerification()) return { ok: false, reason: 'not_permitted' };

  const user = await findByEmail(email);
  if (!user) return { ok: false, reason: 'not_found' };

  const pinHash = await hashPin(newPin);
  const now = new Date().toISOString();
  await execute(
    `UPDATE users SET pin_hash = $1, pin_failed_attempts = 0, pin_locked_until = NULL,
            email_verified_at = COALESCE(email_verified_at, $2), updated_at = $2 WHERE id = $3`,
    [pinHash, now, user.id],
  );
  await revokeAllSessionsForUser(user.id);

  const row = (await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [user.id]))!;
  const session = await createSession({ userId: row.id, userAgent: context.userAgent, ip: context.ip });
  return { ok: true, user: toPublicUser(row), sessionToken: session.token, expiresAt: session.expiresAt };
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
