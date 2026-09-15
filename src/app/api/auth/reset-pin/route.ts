import { NextResponse, type NextRequest } from 'next/server';
import { resetPinSchema, directResetPinSchema } from '@/lib/validation/schemas';
import { resetPin, resetPinWithoutEmail, requiresEmailVerification } from '@/lib/services/auth';
import { verifyTurnstile, turnstileUnavailable, TURNSTILE_UNAVAILABLE_MESSAGE } from '@/lib/services/turnstile';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/services/sessions';
import { apiError, validationError, rateLimited } from '@/lib/api/responses';
import { requestContext } from '@/lib/api/request-context';

/**
 * Two routes to a new PIN:
 *  - a one-time emailed link, whenever email verification is in force;
 *  - the address alone, only where there is no mail transport at all.
 *
 * The second is rejected by the service the moment verification is required, so
 * a live deployment can never reset a PIN without proving inbox ownership.
 */
export async function POST(request: NextRequest) {
  const { ip, userAgent } = requestContext(request);

  const limit = await consumeRateLimit(`pin-reset:${ip ?? 'unknown'}`, RATE_RULES.pinReset);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const payload = await request.json().catch(() => ({}));

  if (!requiresEmailVerification() && !(payload as { token?: string }).token) {
    const parsed = directResetPinSchema.safeParse(payload);
    if (!parsed.success) return validationError(parsed.error);

    const turnstile = await verifyTurnstile(parsed.data.turnstileToken, ip);
    if (!turnstile.success) {
      return turnstileUnavailable(turnstile)
        ? apiError(400, 'turnstile_unavailable', TURNSTILE_UNAVAILABLE_MESSAGE)
        : apiError(400, 'turnstile_failed', 'The robot check did not pass. Try it again.');
    }

    const result = await resetPinWithoutEmail(parsed.data.email, parsed.data.pin, { ip, userAgent });
    if (!result.ok) {
      return result.reason === 'not_found'
        ? apiError(404, 'not_found', 'No account uses that email address.')
        : apiError(400, 'not_permitted', 'Resetting a PIN needs the link we email you.');
    }

    const response = NextResponse.json({ status: 'reset', user: result.user });
    response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(result.expiresAt));
    return response;
  }

  const parsed = resetPinSchema.safeParse(payload);
  if (!parsed.success) return validationError(parsed.error);

  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (!turnstile.success) {
    return turnstileUnavailable(turnstile)
      ? apiError(400, 'turnstile_unavailable', TURNSTILE_UNAVAILABLE_MESSAGE)
      : apiError(400, 'turnstile_failed', 'The robot check did not pass. Try it again.');
  }

  // Resetting the PIN also revokes every existing session for the account.
  const result = await resetPin(parsed.data.token, parsed.data.pin, { ip, userAgent });

  if (!result.ok) {
    const messages = {
      not_found: 'That reset link is not valid. Ask for a fresh one.',
      expired: 'That reset link has expired. Ask for a fresh one.',
      already_used: 'That reset link has already been used. Ask for a fresh one.',
    } as const;
    return apiError(400, result.reason, messages[result.reason]);
  }

  const response = NextResponse.json({ status: 'reset', user: result.user });
  response.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(result.expiresAt));
  return response;
}
