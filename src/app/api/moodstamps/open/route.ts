import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { markMoodStampOpened } from '@/lib/services/moodstamp-delivery';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { apiError, rateLimited } from '@/lib/api/responses';
import { requestContext } from '@/lib/api/request-context';
import { hashIp } from '@/lib/services/crypto';

const bodySchema = z.object({ token: z.string().min(16).max(128) });

/**
 * Records that the recipient opened their MoodStamp.
 *
 * Called by the recipient's page from the browser, not when the page is
 * fetched: mail scanners follow every link in an email the moment it lands,
 * and would otherwise mark every stamp opened before anyone had looked.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError(400, 'bad_request', 'Missing link.');

  const limit = await consumeRateLimit(
    `moodstamp-public:${hashIp(requestContext(request).ip) ?? 'unknown'}`,
    RATE_RULES.moodStampPublic,
  );
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const found = await markMoodStampOpened(parsed.data.token);
  if (!found) return apiError(404, 'not_found', 'There is no MoodStamp here.');
  return NextResponse.json({ ok: true });
}
