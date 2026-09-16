import { NextResponse, type NextRequest } from 'next/server';
import { loginSchema } from '@/lib/validation/schemas';
import { loginWithPin } from '@/lib/services/auth';
import { verifyTurnstile, turnstileUnavailable, TURNSTILE_UNAVAILABLE_MESSAGE } from '@/lib/services/turnstile';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/services/sessions';
import { apiError, validationError, rateLimited } from '@/lib/api/responses';
import { requestContext, safeRedirect } from '@/lib/api/request-context';

export async function POST(request: NextRequest) {
  const { ip, userAgent } = requestContext(request);

  const limit = await consumeRateLimit(`login:ip:${ip ?? 'unknown'}`, RATE_RULES.login);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const parsed = loginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);

  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (!turnstile.success) {
    return turnstileUnavailable(turnstile)
      ? apiError(400, 'turnstile_unavailable', TURNSTILE_UNAVAILABLE_MESSAGE)
      : apiError(400, 'turnstile_failed', 'The robot check did not pass. Try it again.');
  }

  const redirectTo = safeRedirect(parsed.data.redirectTo, '/');
  const previousSessionToken = request.cookies.get(SESSION_COOKIE)?.value ?? null;

  const outcome = await loginWithPin({
    email: parsed.data.email,
    pin: parsed.data.pin,
    previousSessionToken,
    userAgent,
    ip,
    redirectTo,
  });

  switch (outcome.status) {
    case 'success': {
      const response = NextResponse.json({
        status: 'success',
        user: outcome.user,
        redirectTo,
      });
      // Session rotation happened in the service; this sets the new token.
      response.cookies.set(SESSION_COOKIE, outcome.sessionToken, sessionCookieOptions(outcome.expiresAt));
      return response;
    }
    case 'step_up_required':
      return NextResponse.json({ status: 'step_up_required' });
    case 'verification_required':
      return NextResponse.json({ status: 'verification_required' });
    case 'rate_limited':
      return rateLimited(outcome.retryAfterSeconds);
    case 'suspended':
      // Reached only with the correct PIN, so this discloses nothing to someone
      // guessing addresses — and the owner deserves to know why, not a lie
      // about their credentials.
      return apiError(
        403,
        'account_suspended',
        outcome.reason
          ? `This account has been suspended: ${outcome.reason}`
          : 'This account has been suspended. Contact support if you think that is a mistake.',
      );
    default:
      // Never distinguishes "no such account" from "wrong PIN".
      return apiError(401, 'invalid_credentials', 'That email and PIN combination did not work.');
  }
}
