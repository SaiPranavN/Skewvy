import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  verifyTurnstile,
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
    const original = process.env.NODE_ENV;

    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    expect(turnstileDisabled()).toBe(false);

    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true });
    expect(turnstileDisabled()).toBe(true);

    Object.defineProperty(process.env, 'NODE_ENV', { value: original, configurable: true });
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
