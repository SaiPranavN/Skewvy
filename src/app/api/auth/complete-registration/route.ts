import { NextResponse, type NextRequest } from 'next/server';
import { completeRegistrationSchema } from '@/lib/validation/schemas';
import { completeRegistration } from '@/lib/services/auth';
import { verifyTurnstile, turnstileUnavailable, TURNSTILE_UNAVAILABLE_MESSAGE } from '@/lib/services/turnstile';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/services/sessions';
import { apiError, validationError, rateLimited } from '@/lib/api/responses';
import { requestContext, safeRedirect } from '@/lib/api/request-context';

/**
 * Step two of sign-up: the address has been proven, so the account is made.
 *
 * The link token is the only authority here. It was sent to an inbox, it is
 * single use, and burning it is what creates the account — so a PIN can never
 * be set on an address nobody has shown they control.
 */
export async function POST(request: NextRequest) {
  const { ip, userAgent } = requestContext(request);

  const limit = await consumeRateLimit(`complete-registration:${ip ?? 'unknown'}`, RATE_RULES.register);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const parsed = completeRegistrationSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);

  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (!turnstile.success) {
    return turnstileUnavailable(turnstile)
      ? apiError(400, 'turnstile_unavailable', TURNSTILE_UNAVAILABLE_MESSAGE)
      : apiError(400, 'turnstile_failed', 'The robot check did not pass. Try it again.');
  }

  const result = await completeRegistration({
    token: parsed.data.token,
    pin: parsed.data.pin,
    ip,
    userAgent,
  });

  if (result.status === 'link_invalid') {
    return apiError(400, 'link_invalid', linkMessage(result.reason), { fields: { form: linkMessage(result.reason) } });
  }

  if (result.status === 'account_exists') {
    return apiError(409, 'account_exists', 'That address already has an account. Sign in instead.');
  }

  const response = NextResponse.json({
    status: 'signed_in',
    user: result.user,
    redirectTo: safeRedirect(result.redirectTo, '/'),
  });
  response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(result.expiresAt));
  return response;
}

function linkMessage(reason: 'not_found' | 'expired' | 'already_used'): string {
  if (reason === 'expired') return 'That link has expired. Start again and we will send a fresh one.';
  if (reason === 'already_used') return 'That link has already been used. Sign in, or start again.';
  return 'That link is not valid. Start again and we will send a fresh one.';
}
