/**
 * Cloudflare Turnstile. Always verified server-side — a token that only passed
 * in the browser proves nothing.
 */

/** Cloudflare's documented always-passes pair, used when no real keys are set. */
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function turnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || TURNSTILE_TEST_SITE_KEY;
}

function turnstileSecret(): string {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || TURNSTILE_TEST_SECRET_KEY;
}

/** Set TURNSTILE_DISABLED=1 only for automated tests, never in production. */
export function turnstileDisabled(): boolean {
  return process.env.TURNSTILE_DISABLED === '1' && process.env.NODE_ENV !== 'production';
}

export interface TurnstileResult {
  success: boolean;
  errorCodes: string[];
}

export async function verifyTurnstile(token: string, remoteIp?: string | null): Promise<TurnstileResult> {
  if (turnstileDisabled()) return { success: true, errorCodes: [] };
  if (!token) return { success: false, errorCodes: ['missing-input-response'] };

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
    // A Turnstile outage must not silently open the gate.
    return { success: false, errorCodes: ['verification-unavailable'] };
  }
}
