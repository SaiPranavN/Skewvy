/**
 * Cloudflare Turnstile. Always verified server-side — a token that only passed
 * in the browser proves nothing.
 */

/** Cloudflare's documented always-passes pair, used when no real keys are set. */
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

/**
 * Sent by the client when the widget could not load — a blocked iframe, an
 * extension, or an offline network. It is accepted only while Turnstile is
 * running on the public test keys, where the check has no security value
 * anyway. With real keys configured it is always rejected.
 */
export const TURNSTILE_FALLBACK_TOKEN = 'skewvy-widget-unavailable';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function turnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || TURNSTILE_TEST_SITE_KEY;
}

function turnstileSecret(): string {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || TURNSTILE_TEST_SECRET_KEY;
}

/**
 * True once a real site key and secret are both configured. Until then the app
 * runs on Cloudflare's test pair, which passes every token unconditionally.
 */
export function turnstileConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() && process.env.TURNSTILE_SECRET_KEY?.trim());
}

/** Set TURNSTILE_DISABLED=1 only for automated tests, never in production. */
export function turnstileDisabled(): boolean {
  return process.env.TURNSTILE_DISABLED === '1' && process.env.NODE_ENV !== 'production';
}

export interface TurnstileResult {
  success: boolean;
  errorCodes: string[];
}

/**
 * Whether the check failed because the widget never loaded, rather than because
 * the challenge was failed.
 *
 * These are opposite problems. A failed challenge means try again; a widget
 * that could not load means trying again will fail the same way forever, and
 * the person is locked out of the site through no fault of their own — usually
 * a privacy extension, a blocked iframe, or a network that filters Cloudflare.
 * Telling them to "try again" in that state is the worst possible answer.
 */
export function turnstileUnavailable(result: TurnstileResult): boolean {
  return result.errorCodes.includes('fallback-token-rejected');
}

/** The message shown when the widget could not load. */
export const TURNSTILE_UNAVAILABLE_MESSAGE =
  'The robot check could not load in this browser, so we cannot confirm you are human. ' +
  'It is usually a privacy extension or a blocked iframe — try disabling content blocking for this site, ' +
  'or use a different browser.';

export async function verifyTurnstile(token: string, remoteIp?: string | null): Promise<TurnstileResult> {
  if (turnstileDisabled()) return { success: true, errorCodes: [] };
  if (!token) return { success: false, errorCodes: ['missing-input-response'] };

  // Without real keys the widget is a demonstration, not a gate. A browser that
  // cannot load it must still be able to reach the sign-in form.
  if (token === TURNSTILE_FALLBACK_TOKEN) {
    return turnstileConfigured()
      ? { success: false, errorCodes: ['fallback-token-rejected'] }
      : { success: true, errorCodes: [] };
  }

  const body = new URLSearchParams({ secret: turnstileSecret(), response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { success: false, errorCodes: [`http-${response.status}`] };

    const data = (await response.json()) as { success: boolean; 'error-codes'?: string[] };
    return { success: Boolean(data.success), errorCodes: data['error-codes'] ?? [] };
  } catch {
    // A Turnstile outage must not silently open the gate once real keys are in
    // use; on the test keys there is nothing to protect, so sign-in continues.
    return turnstileConfigured()
      ? { success: false, errorCodes: ['verification-unavailable'] }
      : { success: true, errorCodes: ['verification-unavailable'] };
  }
}
