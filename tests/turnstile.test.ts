import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  verifyTurnstile,
  turnstileUnavailable,
  TURNSTILE_UNAVAILABLE_MESSAGE,
  turnstileConfigured,
  turnstileDisabled,
  turnstileSiteKey,
  TURNSTILE_FALLBACK_TOKEN,
} from '@/lib/services/turnstile';

/**
 * The robot check must never lock a real person out of a demo deployment, and
 * must never be bypassable once real keys are in place.
 */
const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_DISABLED;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('configuration', () => {
  it('falls back to Cloudflare test keys until real ones are set', () => {
    expect(turnstileConfigured()).toBe(false);
    expect(turnstileSiteKey()).toBe('1x00000000000000000000AA');
  });

  it('reports configured once both halves are present', () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '0xREALSITEKEY';
    process.env.TURNSTILE_SECRET_KEY = '0xREALSECRET';
    expect(turnstileConfigured()).toBe(true);
    expect(turnstileSiteKey()).toBe('0xREALSITEKEY');
  });

  it('needs both halves — a site key alone is not configuration', () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '0xREALSITEKEY';
    expect(turnstileConfigured()).toBe(false);
  });

  it('refuses the development bypass in production', () => {
    process.env.TURNSTILE_DISABLED = '1';

    vi.stubEnv('NODE_ENV', 'production');
    expect(turnstileDisabled()).toBe(false);

    vi.stubEnv('NODE_ENV', 'development');
    expect(turnstileDisabled()).toBe(true);

    vi.unstubAllEnvs();
  });
});

describe('token verification', () => {
  it('rejects an empty token outright', async () => {
    const result = await verifyTurnstile('');
    expect(result.success).toBe(false);
    expect(result.errorCodes).toContain('missing-input-response');
  });

  it('accepts the widget-unavailable fallback while on the test keys', async () => {
    // A blocked iframe or a privacy extension must not make sign-in impossible
    // on a deployment where the check has no security value anyway.
    const result = await verifyTurnstile(TURNSTILE_FALLBACK_TOKEN);
    expect(result.success).toBe(true);
  });

  it('rejects the fallback the moment real keys exist', async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '0xREALSITEKEY';
    process.env.TURNSTILE_SECRET_KEY = '0xREALSECRET';

    const result = await verifyTurnstile(TURNSTILE_FALLBACK_TOKEN);
    expect(result.success).toBe(false);
    expect(result.errorCodes).toContain('fallback-token-rejected');
  });
});

describe('a widget that could not load', () => {
  /*
   * Opposite problems needing opposite answers. A failed challenge means try
   * again. A widget that never loaded means trying again fails identically
   * forever, and the person is locked out of the site having done nothing
   * wrong — so they need to be told what to change, not told to retry.
   */
  it('is told apart from a failed challenge', () => {
    expect(turnstileUnavailable({ success: false, errorCodes: ['fallback-token-rejected'] })).toBe(true);
    expect(turnstileUnavailable({ success: false, errorCodes: ['invalid-input-response'] })).toBe(false);
    expect(turnstileUnavailable({ success: false, errorCodes: [] })).toBe(false);
  });

  it('says what to do instead of telling them to retry', () => {
    expect(TURNSTILE_UNAVAILABLE_MESSAGE).not.toMatch(/try it again/i);
    expect(TURNSTILE_UNAVAILABLE_MESSAGE).toMatch(/extension|browser/i);
  });
});
