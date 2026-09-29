import { NextResponse, type NextRequest } from 'next/server';
import { sendDueMoodStampReminders } from '@/lib/services/moodstamp-delivery';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { apiError, rateLimited } from '@/lib/api/responses';
import { requestContext } from '@/lib/api/request-context';
import { hashIp } from '@/lib/services/crypto';

/**
 * The daily sweep that sends MoodStamp reminders (scheduled in vercel.json).
 *
 * With `CRON_SECRET` set, Vercel sends it as a bearer token and nothing else
 * may run the sweep. Without it, anyone may — which does no harm, because a
 * run only sends reminders that are already due, each address at most once a
 * day — but they are rate limited all the same.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      return apiError(401, 'unauthorized', 'Not allowed.');
    }
  } else {
    const limit = await consumeRateLimit(
      `moodstamp-sweep:${hashIp(requestContext(request).ip) ?? 'unknown'}`,
      RATE_RULES.moodStampSweep,
    );
    if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);
  }

  const result = await sendDueMoodStampReminders(100);
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
}
