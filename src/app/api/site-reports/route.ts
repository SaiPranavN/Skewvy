import { NextResponse, type NextRequest } from 'next/server';
import { siteReportSchema } from '@/lib/validation/schemas';
import { createSiteReport } from '@/lib/services/site-reports';
import { verifyTurnstile, turnstileUnavailable, TURNSTILE_UNAVAILABLE_MESSAGE } from '@/lib/services/turnstile';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { SESSION_COOKIE, resolveSession } from '@/lib/services/sessions';
import { apiError, validationError, rateLimited } from '@/lib/api/responses';
import { requestContext } from '@/lib/api/request-context';

/**
 * The public report form. Open to visitors without an account, so it is
 * guarded by a per-IP limit and the robot check. The answer is the same for
 * every accepted report — it never says whether the page was already reported.
 */
export async function POST(request: NextRequest) {
  const { ip } = requestContext(request);

  const limit = await consumeRateLimit(`site-report:${ip ?? 'unknown'}`, RATE_RULES.siteReport);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const parsed = siteReportSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);

  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (!turnstile.success) {
    return turnstileUnavailable(turnstile)
      ? apiError(400, 'turnstile_unavailable', TURNSTILE_UNAVAILABLE_MESSAGE)
      : apiError(400, 'turnstile_failed', 'The robot check did not pass. Try it again.');
  }

  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);

  await createSiteReport({
    targetUrl: parsed.data.targetUrl,
    reason: parsed.data.reason,
    details: parsed.data.details,
    evidenceUrl: parsed.data.evidenceUrl || null,
    contactEmail: parsed.data.contactEmail || null,
    reporterId: session?.user.id ?? null,
    ip,
  });

  return NextResponse.json({ received: true });
}
