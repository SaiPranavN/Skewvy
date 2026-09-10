import { NextResponse, type NextRequest } from 'next/server';
import { resendVerificationSchema } from '@/lib/validation/schemas';
import { resendVerification } from '@/lib/services/auth';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { validationError, rateLimited } from '@/lib/api/responses';
import { requestContext } from '@/lib/api/request-context';

export async function POST(request: NextRequest) {
  const { ip } = requestContext(request);

  const parsed = resendVerificationSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);

  // Cooldown keyed on the address so a resend cannot be used to probe or spam.
  const limit = await consumeRateLimit(
    `resend:${parsed.data.email.toLowerCase()}`,
    RATE_RULES.emailResend,
  );
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  await resendVerification(parsed.data.email, ip);
  return NextResponse.json({ status: 'sent' });
}
