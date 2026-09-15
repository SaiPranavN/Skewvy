import { NextResponse, type NextRequest } from 'next/server';
import { registerSchema } from '@/lib/validation/schemas';
import { registerAccount } from '@/lib/services/auth';
import { verifyTurnstile, turnstileUnavailable, TURNSTILE_UNAVAILABLE_MESSAGE } from '@/lib/services/turnstile';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { apiError, validationError, rateLimited } from '@/lib/api/responses';
import { requestContext, safeRedirect } from '@/lib/api/request-context';

export async function POST(request: NextRequest) {
  const { ip } = requestContext(request);

  const limit = await consumeRateLimit(`register:${ip ?? 'unknown'}`, RATE_RULES.register);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const parsed = registerSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);

  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (!turnstile.success) {
    return turnstileUnavailable(turnstile)
      ? apiError(400, 'turnstile_unavailable', TURNSTILE_UNAVAILABLE_MESSAGE)
      : apiError(400, 'turnstile_failed', 'The robot check did not pass. Try it again.');
  }

  const redirectTo = safeRedirect(parsed.data.redirectTo, '/');

  const result = await registerAccount({
    displayName: parsed.data.displayName,
    email: parsed.data.email,
    ip,
    redirectTo,
  });

  if (result.status === 'account_exists') {
    return NextResponse.json({ status: 'account_exists' });
  }

  /*
   * Where email cannot be delivered there is no inbox to send anyone to, so the
   * second step is handed back directly and the browser continues to it.
   * Production always requires verification, so this branch cannot be reached
   * on a live deployment.
   */
  if (result.status === 'delivery_failed') {
    console.error('[register] verification email not delivered:', result.detail);
    return apiError(
      502,
      'delivery_failed',
      'We could not send the confirmation email just now. Try again in a moment.',
    );
  }

  if (result.status === 'ready_for_pin') {
    return NextResponse.json({ status: 'ready_for_pin', token: result.token, redirectTo });
  }

  return NextResponse.json({ status: 'verification_sent', email: parsed.data.email });
}
