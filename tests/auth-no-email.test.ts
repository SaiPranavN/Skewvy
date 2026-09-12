import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, truncateAll } from './helpers';
import {
  registerAccount,
  loginWithPin,
  requiresEmailVerification,
  requestPinReset,
  resetPinWithoutEmail,
} from '@/lib/services/auth';
import { resolveSession } from '@/lib/services/sessions';
import { outbox } from '@/lib/services/email';

/**
 * Behaviour with no mail transport configured — the prototype default.
 *
 * Nothing here may send anyone to an inbox, because nothing can reach one.
 */
beforeAll(async () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.REQUIRE_EMAIL_VERIFICATION;
  await setupTestDatabase();
});
afterAll(teardownTestDatabase);
beforeEach(truncateAll);

const DEVICE = { userAgent: 'TestBrowser/1.0', ip: '198.51.100.10' };

describe('the requirement rule', () => {
  it('does not require email when there is no way to send it', () => {
    expect(requiresEmailVerification()).toBe(false);
  });

  it('requires it once a transport is configured', () => {
    process.env.RESEND_API_KEY = 're_test_key';
    expect(requiresEmailVerification()).toBe(true);
    delete process.env.RESEND_API_KEY;
  });

  it('can be forced on', () => {
    process.env.REQUIRE_EMAIL_VERIFICATION = '1';
    expect(requiresEmailVerification()).toBe(true);
    delete process.env.REQUIRE_EMAIL_VERIFICATION;
  });

  it('cannot be forced off in production', () => {
    process.env.REQUIRE_EMAIL_VERIFICATION = '0';

    vi.stubEnv('NODE_ENV', 'production');
    expect(requiresEmailVerification()).toBe(true);

    vi.unstubAllEnvs();
    delete process.env.REQUIRE_EMAIL_VERIFICATION;
  });

  it('requires email in production even with no transport configured', () => {

    vi.stubEnv('NODE_ENV', 'production');
    expect(requiresEmailVerification()).toBe(true);

    vi.unstubAllEnvs();
  });
});

describe('registration', () => {
  it('signs the person in immediately and sends nothing', async () => {
    const result = await registerAccount({
      displayName: 'Prototype Tester',
      email: 'anything@whatever.test',
      pin: 'letmein2026',
      ...DEVICE,
      redirectTo: '/flash-news',
    });

    expect(result.status).toBe('signed_in');
    if (result.status !== 'signed_in') return;

    expect(outbox()).toHaveLength(0);
    expect(result.redirectTo).toBe('/flash-news');

    const session = await resolveSession(result.sessionToken);
    expect(session?.user.email).toBe('anything@whatever.test');
    expect(session?.user.emailVerifiedAt).not.toBeNull();
  });

  it('accepts any address without checking it is reachable', async () => {
    for (const email of ['a@b.test', 'someone@example.invalid', 'test@localhost.dev']) {
      await truncateAll();
      const result = await registerAccount({ displayName: 'Tester', email, pin: 'letmein2026', ...DEVICE });
      expect(result.status).toBe('signed_in');
    }
  });

  it('says so plainly when the address already has an account', async () => {
    await registerAccount({ displayName: 'First', email: 'taken@whatever.test', pin: 'letmein2026', ...DEVICE });

    const second = await registerAccount({
      displayName: 'Second',
      email: 'taken@whatever.test',
      pin: 'different2026',
      ...DEVICE,
    });

    // No dead end pointing at an inbox that will never receive anything.
    expect(second.status).toBe('account_exists');
    expect(outbox()).toHaveLength(0);

    // And the original PIN is untouched.
    const login = await loginWithPin({ email: 'taken@whatever.test', pin: 'letmein2026', ...DEVICE });
    expect(login.status).toBe('success');
  });
});

describe('sign-in', () => {
  it('skips step-up on an unrecognised device', async () => {
    await registerAccount({ displayName: 'Tester', email: 'device@whatever.test', pin: 'letmein2026', ...DEVICE });
    outbox().length = 0;

    const result = await loginWithPin({
      email: 'device@whatever.test',
      pin: 'letmein2026',
      userAgent: 'CompletelyDifferentBrowser/9.9',
      ip: '203.0.113.250',
    });

    expect(result.status).toBe('success');
    expect(outbox()).toHaveLength(0);
  });

  it('still rejects a wrong PIN', async () => {
    await registerAccount({ displayName: 'Tester', email: 'strict@whatever.test', pin: 'letmein2026', ...DEVICE });

    const result = await loginWithPin({ email: 'strict@whatever.test', pin: 'notthepin99', ...DEVICE });
    expect(result.status).toBe('invalid_credentials');
  });

  it('still rejects an unknown address', async () => {
    const result = await loginWithPin({ email: 'nobody@whatever.test', pin: 'letmein2026', ...DEVICE });
    expect(result.status).toBe('invalid_credentials');
  });
});

describe('forgotten PIN', () => {
  it('offers a direct reset rather than an email nobody can receive', async () => {
    await registerAccount({ displayName: 'Tester', email: 'forgot@whatever.test', pin: 'letmein2026', ...DEVICE });
    outbox().length = 0;

    const outcome = await requestPinReset('forgot@whatever.test');

    expect(outcome.mode).toBe('set_directly');
    expect(outbox()).toHaveLength(0);
  });

  it('sets the new PIN, signs other sessions out, and signs this one in', async () => {
    const created = await registerAccount({
      displayName: 'Tester',
      email: 'recover@whatever.test',
      pin: 'letmein2026',
      ...DEVICE,
    });
    expect(created.status).toBe('signed_in');
    if (created.status !== 'signed_in') return;

    const result = await resetPinWithoutEmail('recover@whatever.test', 'brand-new-2026', DEVICE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The session that existed before the reset is gone.
    expect(await resolveSession(created.sessionToken)).toBeNull();
    // The one handed back works.
    expect(await resolveSession(result.sessionToken)).not.toBeNull();

    const oldPin = await loginWithPin({ email: 'recover@whatever.test', pin: 'letmein2026', ...DEVICE });
    expect(oldPin.status).toBe('invalid_credentials');

    const newPin = await loginWithPin({ email: 'recover@whatever.test', pin: 'brand-new-2026', ...DEVICE });
    expect(newPin.status).toBe('success');
  });

  it('refuses an address with no account', async () => {
    const result = await resetPinWithoutEmail('ghost@whatever.test', 'brand-new-2026', DEVICE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('is refused outright once email verification is required', async () => {
    await registerAccount({ displayName: 'Tester', email: 'locked@whatever.test', pin: 'letmein2026', ...DEVICE });

    process.env.REQUIRE_EMAIL_VERIFICATION = '1';
    try {
      const result = await resetPinWithoutEmail('locked@whatever.test', 'brand-new-2026', DEVICE);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('not_permitted');

      // And the original PIN is untouched.
      const login = await loginWithPin({ email: 'locked@whatever.test', pin: 'letmein2026', ...DEVICE });
      expect(login.status).toBe('success');
    } finally {
      delete process.env.REQUIRE_EMAIL_VERIFICATION;
    }
  });

  it('emails a link instead whenever a transport is configured', async () => {
    process.env.REQUIRE_EMAIL_VERIFICATION = '1';
    try {
      const outcome = await requestPinReset('nobody-here@whatever.test');
      expect(outcome.mode).toBe('emailed');
    } finally {
      delete process.env.REQUIRE_EMAIL_VERIFICATION;
    }
  });
});
