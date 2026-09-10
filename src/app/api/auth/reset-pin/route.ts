import { NextResponse, type NextRequest } from 'next/server';
import { resetPinSchema } from '@/lib/validation/schemas';
import { resetPin } from '@/lib/services/auth';
import { verifyTurnstile } from '@/lib/services/turnstile';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/services/sessions';
import { apiError, validationError, rateLimited } from '@/lib/api/responses';
import { requestContext } from '@/lib/api/request-context';

export async function POST(request: NextRequest) {
  const { ip, userAgent } = requestContext(request);

  const limit = await consumeRateLimit(`pin-reset:${ip ?? 'unknown'}`, RATE_RULES.pinReset);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const parsed = resetPinSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);

  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (!turnstile.success) {
    return apiError(400, 'turnstile_failed', 'The robot check did not pass. Try it again.');
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
