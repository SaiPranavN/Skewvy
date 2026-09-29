import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, resolveSession } from '@/lib/services/sessions';
import { deliverMoodStampByEmail } from '@/lib/services/moodstamp-delivery';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { apiError, rateLimited } from '@/lib/api/responses';

/**
 * Emails a stamp that has not gone out yet: one that failed, or one saved
 * before email delivery existed. Its sender only — for anyone else the stamp
 * does not exist.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return apiError(401, 'unauthorized', 'Sign in to send a MoodStamp.');

  const limit = await consumeRateLimit(`moodstamp-deliver:${session.user.id}`, RATE_RULES.moodStampDeliver);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const { id } = await params;
  const outcome = await deliverMoodStampByEmail(id, session.user.id);
  if (!outcome.record) return apiError(404, 'not_found', 'There is no MoodStamp here.');

  return NextResponse.json(
    { status: outcome.status, moodStamp: outcome.record },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}
