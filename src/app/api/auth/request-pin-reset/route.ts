import { NextResponse, type NextRequest } from 'next/server';
import { requestPinResetSchema } from '@/lib/validation/schemas';
import { requestPinReset } from '@/lib/services/auth';
import { verifyTurnstile } from '@/lib/services/turnstile';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { apiError, validationError, rateLimited } from '@/lib/api/responses';
import { requestContext } from '@/lib/api/request-context';

export async function POST(request: NextRequest) {
  const { ip } = requestContext(request);

  const parsed = requestPinResetSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);

  const limit = await consumeRateLimit(
    `pin-reset-request:${parsed.data.email.toLowerCase()}`,
    RATE_RULES.pinResetRequest,
  );
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (!turnstile.success) {
    return apiError(400, 'turnstile_failed', 'The robot check did not pass. Try it again.');
  }

  await requestPinReset(parsed.data.email, ip);

  // Identical response whether or not that address has a verified account.
  return NextResponse.json({ status: 'sent' });
}
