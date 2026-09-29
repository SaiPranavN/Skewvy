import { NextResponse, type NextRequest } from 'next/server';
import { optOutByToken } from '@/lib/services/moodstamp-delivery';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { apiError, rateLimited } from '@/lib/api/responses';
import { requestContext } from '@/lib/api/request-context';
import { hashIp } from '@/lib/services/crypto';

/**
 * Stops MoodStamp emails to an address.
 *
 * POST is the one-click unsubscribe mail providers send on the recipient's
 * behalf (RFC 8058, from the List-Unsubscribe header), and also what the
 * confirmation page sends. A GET never unsubscribes — link scanners fetch
 * every URL in a message — it only forwards to the page that asks.
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';

  const limit = await consumeRateLimit(
    `moodstamp-public:${hashIp(requestContext(request).ip) ?? 'unknown'}`,
    RATE_RULES.moodStampPublic,
  );
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const done = await optOutByToken(token);
  if (!done) return apiError(404, 'not_found', 'This link is not valid.');
  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  return NextResponse.redirect(new URL(`/moodstamps/opt-out/${encodeURIComponent(token)}`, request.url));
}
