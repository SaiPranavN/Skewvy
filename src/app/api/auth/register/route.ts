import { NextResponse, type NextRequest } from 'next/server';
import { registerSchema } from '@/lib/validation/schemas';
import { registerAccount } from '@/lib/services/auth';
import { verifyTurnstile } from '@/lib/services/turnstile';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { apiError, validationError, rateLimited } from '@/lib/api/responses';
import { requestContext, safeRedirect } from '@/lib/api/request-context';

export async function POST(request: NextRequest) {
  const { ip, userAgent } = requestContext(request);
  void userAgent;

  const limit = await consumeRateLimit(`register:${ip ?? 'unknown'}`, RATE_RULES.register);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const parsed = registerSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);

  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (!turnstile.success) {
    return apiError(400, 'turnstile_failed', 'The robot check did not pass. Try it again.');
  }

  await registerAccount({
    displayName: parsed.data.displayName,
    email: parsed.data.email,
    pin: parsed.data.pin,
    ip,
    redirectTo: safeRedirect(parsed.data.redirectTo, '/'),
  });

  // Deliberately identical whether or not the address already had an account.
  return NextResponse.json({ status: 'verification_sent' });
}
