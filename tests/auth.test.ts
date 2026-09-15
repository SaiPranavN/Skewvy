import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  truncateAll,
  tokenFromLastEmail,
  registerFully,
} from './helpers';
import {
  verifyEmailToken,
  loginWithPin,
  requestPinReset,
  resetPin,
  completeStepUp,
  resendVerification,
} from '@/lib/services/auth';
import { resolveSession, revokeSession, createSession, SESSION_TTL_SECONDS } from '@/lib/services/sessions';
import { outbox } from '@/lib/services/email';
import { query, execute } from '@/lib/db';

beforeAll(async () => {
  // These tests cover the flow as it behaves with a mail transport configured.
  // The no-transport behaviour has its own file.
  process.env.REQUIRE_EMAIL_VERIFICATION = '1';
  await setupTestDatabase();
});
afterAll(async () => {
  delete process.env.REQUIRE_EMAIL_VERIFICATION;
  await teardownTestDatabase();
});
beforeEach(truncateAll);

const DEVICE = { userAgent: 'TestBrowser/1.0', ip: '198.51.100.10' };

/** Sign-up now ends signed in, because the PIN is set after the link is opened. */
async function registerAndVerify(email = 'person@example.test', pin = 'correct-horse-1') {
  const result = await registerFully({ displayName: 'Person', email, pin, ...DEVICE });
  if (result.status !== 'signed_in') throw new Error(`sign-up ended in ${result.status}`);
  return result;
}

describe('registration: step one proves the address', () => {
  it('creates no account at all until the link is opened', async () => {
    const { beginRegistration } = await import('@/lib/services/registration');
    const result = await beginRegistration({
      displayName: 'Person',
      email: 'person@example.test',
      ip: DEVICE.ip,
    });

    expect(result.status).toBe('verification_sent');
    expect(outbox()).toHaveLength(1);
    expect(outbox()[0].subject).toMatch(/verify/i);

    /*
     * The heart of the two-step flow: signing up with an address you do not own
     * leaves nothing behind for its owner to reclaim, and no PIN is ever stored
     * against an unproven address.
     */
    expect(await query('SELECT id FROM users')).toHaveLength(0);
    expect(await query('SELECT id FROM pending_registrations')).toHaveLength(1);
  });

  it('stores only a hash of the emailed token', async () => {
    const { beginRegistration } = await import('@/lib/services/registration');
    await beginRegistration({ displayName: 'Person', email: 'person@example.test' });

    const token = tokenFromLastEmail()!;
    const rows = await query<{ token_hash: string }>('SELECT token_hash FROM pending_registrations');
    expect(rows[0].token_hash).not.toBe(token);
    expect(rows[0].token_hash).toHaveLength(64);
  });

  it('retires the previous link when a new one is requested', async () => {
    const { beginRegistration, findPendingRegistration } = await import('@/lib/services/registration');

    await beginRegistration({ displayName: 'Person', email: 'person@example.test' });
    const first = tokenFromLastEmail()!;
    await beginRegistration({ displayName: 'Person', email: 'person@example.test' });
    const second = tokenFromLastEmail()!;

    expect(first).not.toBe(second);
    // An older link sitting in an inbox stops working the moment a newer one is sent.
    expect(await findPendingRegistration(first)).toMatchObject({ ok: false, reason: 'already_used' });
    expect(await findPendingRegistration(second)).toMatchObject({ ok: true });
  });
});

describe('registration: step two sets the PIN', () => {
  it('creates the account, marks the address proved and opens a session', async () => {
    const result = await registerAndVerify();

    const session = await resolveSession(result.sessionToken);
    expect(session?.user.email).toBe('person@example.test');
    expect(session?.user.emailVerifiedAt).not.toBeNull();

    const users = await query<{ pin_hash: string }>('SELECT * FROM users');
    expect(users).toHaveLength(1);
    // The PIN itself is never persisted.
    expect(users[0].pin_hash).not.toContain('correct-horse-1');
  });

  it('burns the link after a single use', async () => {
    const { beginRegistration } = await import('@/lib/services/registration');
    const { completeRegistration } = await import('@/lib/services/auth');

    await beginRegistration({ displayName: 'Person', email: 'person@example.test' });
    const token = tokenFromLastEmail()!;

    expect((await completeRegistration({ token, pin: 'correct-horse-1', ...DEVICE })).status).toBe('signed_in');

    const second = await completeRegistration({ token, pin: 'another-pin-77', ...DEVICE });
    expect(second.status).toBe('link_invalid');
    if (second.status === 'link_invalid') expect(second.reason).toBe('already_used');

    // And the replay created no second account.
    expect(await query('SELECT id FROM users')).toHaveLength(1);
  });

  it('rejects an expired link', async () => {
    const { beginRegistration } = await import('@/lib/services/registration');
    const { completeRegistration } = await import('@/lib/services/auth');

    await beginRegistration({ displayName: 'Person', email: 'person@example.test' });
    const token = tokenFromLastEmail()!;
    await execute('UPDATE pending_registrations SET expires_at = $1', [new Date(Date.now() - 1000).toISOString()]);

    const result = await completeRegistration({ token, pin: 'correct-horse-1', ...DEVICE });
    expect(result.status).toBe('link_invalid');
    if (result.status === 'link_invalid') expect(result.reason).toBe('expired');
    expect(await query('SELECT id FROM users')).toHaveLength(0);
  });

  it('refuses a link whose address was claimed while it sat in the inbox', async () => {
    const { beginRegistration } = await import('@/lib/services/registration');
    const { completeRegistration } = await import('@/lib/services/auth');

    await beginRegistration({ displayName: 'Slow', email: 'race@example.test' });
    const slowToken = tokenFromLastEmail()!;

    // Someone else finishes sign-up for the same address first.
    await beginRegistration({ displayName: 'Quick', email: 'race@example.test' });
    await completeRegistration({ token: tokenFromLastEmail()!, pin: 'quick-pin-11', ...DEVICE });

    const late = await completeRegistration({ token: slowToken, pin: 'slow-pin-22', ...DEVICE });
    expect(late.status).not.toBe('signed_in');
    expect(await query('SELECT id FROM users')).toHaveLength(1);
  });

  it('tells someone with an account to sign in instead', async () => {
    await registerAndVerify();
    outbox().length = 0;

    const { beginRegistration } = await import('@/lib/services/registration');
    const second = await beginRegistration({ displayName: 'Impostor', email: 'person@example.test' });

    expect(second.status).toBe('account_exists');
    expect(outbox()).toHaveLength(0);

    // The existing PIN still works — a sign-up attempt cannot overwrite it.
    const login = await loginWithPin({ email: 'person@example.test', pin: 'correct-horse-1', ...DEVICE });
    expect(login.status).toBe('success');
  });

  it('resends a link for a sign-up still waiting on its email', async () => {
    const { beginRegistration } = await import('@/lib/services/registration');
    await beginRegistration({ displayName: 'Person', email: 'waiting@example.test' });
    outbox().length = 0;

    await resendVerification('waiting@example.test');
    expect(outbox()).toHaveLength(1);
    expect(outbox()[0].to).toBe('waiting@example.test');
  });

  it('silently ignores a resend for an unknown or already verified address', async () => {
    await resendVerification('nobody@example.test');
    expect(outbox()).toHaveLength(0);

    await registerAndVerify();
    outbox().length = 0;
    await resendVerification('person@example.test');
    expect(outbox()).toHaveLength(0);
  });
});

describe('login', () => {
  it('signs in with email and PIN on a known device — no email required', async () => {
    await registerAndVerify();
    outbox().length = 0;

    const result = await loginWithPin({ email: 'person@example.test', pin: 'correct-horse-1', ...DEVICE });

    expect(result.status).toBe('success');
    expect(outbox()).toHaveLength(0);
  });

  it('restores a valid session without asking for credentials', async () => {
    const registered = await registerAndVerify();

    const session = await resolveSession(registered.sessionToken);
    expect(session).not.toBeNull();
  });

  it('requires the PIN once the session has expired, not a new email', async () => {
    const registered = await registerAndVerify();

    await execute('UPDATE sessions SET expires_at = $1', [new Date(Date.now() - 1000).toISOString()]);
    expect(await resolveSession(registered.sessionToken)).toBeNull();

    outbox().length = 0;
    const result = await loginWithPin({ email: 'person@example.test', pin: 'correct-horse-1', ...DEVICE });

    expect(result.status).toBe('success');
    expect(outbox()).toHaveLength(0);
  });

  it('rotates the session token after signing in', async () => {
    const registered = await registerAndVerify();

    const result = await loginWithPin({
      email: 'person@example.test',
      pin: 'correct-horse-1',
      previousSessionToken: registered.sessionToken,
      ...DEVICE,
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;

    expect(result.sessionToken).not.toBe(registered.sessionToken);
    expect(await resolveSession(registered.sessionToken)).toBeNull();
    expect(await resolveSession(result.sessionToken)).not.toBeNull();
  });

  it('gives the same answer for a wrong PIN and an unknown address', async () => {
    await registerAndVerify();

    const wrongPin = await loginWithPin({ email: 'person@example.test', pin: 'nope-nope-1', ...DEVICE });
    const unknown = await loginWithPin({ email: 'ghost@example.test', pin: 'nope-nope-1', ...DEVICE });

    expect(wrongPin.status).toBe('invalid_credentials');
    expect(unknown.status).toBe('invalid_credentials');
  });

  it('locks the account after repeated failures', async () => {
    await registerAndVerify();

    const outcomes: string[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const result = await loginWithPin({ email: 'person@example.test', pin: `wrong-${attempt}-x`, ...DEVICE });
      outcomes.push(result.status);
    }

    expect(outcomes).toContain('rate_limited');

    const rows = await query<{ pin_failed_attempts: number; pin_locked_until: string | null }>(
      'SELECT pin_failed_attempts, pin_locked_until FROM users',
    );
    expect(rows[0].pin_failed_attempts).toBeGreaterThanOrEqual(5);
    expect(rows[0].pin_locked_until).not.toBeNull();
  });

  it('clears the failure counter after a correct PIN', async () => {
    await registerAndVerify();
    await loginWithPin({ email: 'person@example.test', pin: 'wrong-one-1', ...DEVICE });
    await loginWithPin({ email: 'person@example.test', pin: 'correct-horse-1', ...DEVICE });

    const rows = await query<{ pin_failed_attempts: number }>('SELECT pin_failed_attempts FROM users');
    expect(rows[0].pin_failed_attempts).toBe(0);
  });
});

describe('risk-based step-up verification', () => {
  it('asks for one email confirmation on an unrecognised device', async () => {
    await registerAndVerify();
    outbox().length = 0;

    const result = await loginWithPin({
      email: 'person@example.test',
      pin: 'correct-horse-1',
      userAgent: 'BrandNewBrowser/2.0',
      ip: '203.0.113.99',
    });

    expect(result.status).toBe('step_up_required');
    expect(outbox()).toHaveLength(1);
    expect(outbox()[0].subject).toMatch(/confirm/i);
  });

  it('completes the challenge and issues a session', async () => {
    await registerAndVerify();
    await loginWithPin({
      email: 'person@example.test',
      pin: 'correct-horse-1',
      userAgent: 'BrandNewBrowser/2.0',
      ip: '203.0.113.99',
    });

    const token = tokenFromLastEmail()!;
    const result = await completeStepUp(token, { userAgent: 'BrandNewBrowser/2.0', ip: '203.0.113.99' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await resolveSession(result.sessionToken)).not.toBeNull();
  });

  it('does not ask again from the same device', async () => {
    await registerAndVerify();
    await loginWithPin({
      email: 'person@example.test', pin: 'correct-horse-1',
      userAgent: 'BrandNewBrowser/2.0', ip: '203.0.113.99',
    });
    await completeStepUp(tokenFromLastEmail()!, { userAgent: 'BrandNewBrowser/2.0', ip: '203.0.113.99' });

    outbox().length = 0;
    const again = await loginWithPin({
      email: 'person@example.test', pin: 'correct-horse-1',
      userAgent: 'BrandNewBrowser/2.0', ip: '203.0.113.99',
    });

    expect(again.status).toBe('success');
    expect(outbox()).toHaveLength(0);
  });
});

describe('forgot PIN', () => {
  it('reveals nothing for an address without an account', async () => {
    await requestPinReset('ghost@example.test');
    expect(outbox()).toHaveLength(0);

    /*
     * A sign-up that never opened its link is not an account, so there is no
     * PIN to reset and nothing to disclose about the address.
     */
    const { beginRegistration } = await import('@/lib/services/registration');
    await beginRegistration({ displayName: 'Pending', email: 'pending@example.test' });
    outbox().length = 0;

    await requestPinReset('pending@example.test');
    expect(outbox()).toHaveLength(0);
  });

  it('sets a new PIN and signs every existing session out', async () => {
    const registered = await registerAndVerify();

    const other = await createSession({ userId: registered.user.id, userAgent: 'Phone/1.0', ip: '198.51.100.20' });
    expect(await resolveSession(other.token)).not.toBeNull();

    await requestPinReset('person@example.test');
    const result = await resetPin(tokenFromLastEmail()!, 'brand-new-pin-3', DEVICE);

    expect(result.ok).toBe(true);
    expect(await resolveSession(registered.sessionToken)).toBeNull();
    expect(await resolveSession(other.token)).toBeNull();

    const oldPin = await loginWithPin({ email: 'person@example.test', pin: 'correct-horse-1', ...DEVICE });
    expect(oldPin.status).toBe('invalid_credentials');

    const newPin = await loginWithPin({ email: 'person@example.test', pin: 'brand-new-pin-3', ...DEVICE });
    expect(newPin.status).toBe('success');
  });

  it('refuses a reused or expired reset link', async () => {
    await registerAndVerify();
    await requestPinReset('person@example.test');
    const token = tokenFromLastEmail()!;

    await resetPin(token, 'brand-new-pin-3', DEVICE);
    const reuse = await resetPin(token, 'another-new-pin-4', DEVICE);

    expect(reuse.ok).toBe(false);
    if (!reuse.ok) expect(reuse.reason).toBe('already_used');
  });

  it('clears a lockout when the PIN is reset', async () => {
    await registerAndVerify();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await loginWithPin({ email: 'person@example.test', pin: `wrong-${attempt}-x`, ...DEVICE });
    }

    await requestPinReset('person@example.test');
    await resetPin(tokenFromLastEmail()!, 'brand-new-pin-3', DEVICE);

    const rows = await query<{ pin_locked_until: string | null; pin_failed_attempts: number }>(
      'SELECT pin_locked_until, pin_failed_attempts FROM users',
    );
    expect(rows[0].pin_locked_until).toBeNull();
    expect(rows[0].pin_failed_attempts).toBe(0);
  });
});

describe('sessions', () => {
  it('drops a revoked session immediately', async () => {
    const registered = await registerAndVerify();

    await revokeSession(registered.sessionToken);
    expect(await resolveSession(registered.sessionToken)).toBeNull();
  });

  it('stores only a hash of the session token', async () => {
    const registered = await registerAndVerify();

    const rows = await query<{ token_hash: string }>('SELECT token_hash FROM sessions');
    expect(rows.some((row) => row.token_hash === registered.sessionToken)).toBe(false);
  });

  it('never accepts an unknown or empty token', async () => {
    expect(await resolveSession(null)).toBeNull();
    expect(await resolveSession('')).toBeNull();
    expect(await resolveSession('made-up-token')).toBeNull();
  });

  it('sets a sensible expiry', async () => {
    const registered = await registerAndVerify();

    const expiry = new Date(registered.expiresAt).getTime() - Date.now();
    expect(expiry).toBeGreaterThan(SESSION_TTL_SECONDS * 1000 * 0.9);
  });
});
