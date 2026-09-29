import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, resolveSession } from '@/lib/services/sessions';
import { createMoodStamp, loadMoodStampBoard } from '@/lib/services/moodstamps';
import { deliverMoodStampByEmail } from '@/lib/services/moodstamp-delivery';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { apiError, rateLimited, validationError } from '@/lib/api/responses';
import { moodStampCreateSchema } from '@/lib/moodstamps/validation';

/**
 * The signed-in person's own MoodStamp board.
 *
 * It takes no user id and no filter: whose board it is comes from the session
 * cookie alone, so there is nothing in the request that could point it at
 * someone else's. The answer is private and never cached.
 */
export async function GET(request: NextRequest) {
  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return apiError(401, 'unauthorized', 'Sign in to see your MoodStamps.');

  const board = await loadMoodStampBoard(session.user.id);
  return NextResponse.json(board, { headers: { 'cache-control': 'private, no-store' } });
}

/**
 * Sends a MoodStamp: saves it, and emails it when that is the chosen route.
 *
 * The same schema the form uses runs again here, language checks and all: the
 * form is a guide, and this is the rule. The sender is always the session's
 * own account, never a name or id from the body.
 *
 * The stamp is saved before the email is attempted, so a failed send leaves a
 * stamp the sender can retry rather than one they have to write again. The
 * response carries the outcome either way. WhatsApp is not delivered yet.
 */
export async function POST(request: NextRequest) {
  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return apiError(401, 'unauthorized', 'Sign in to send a MoodStamp.');

  const parsed = moodStampCreateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);

  const limit = await consumeRateLimit(`moodstamp:${session.user.id}`, RATE_RULES.moodStampCreate);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  let moodStamp = await createMoodStamp({ sender: session.user, ...parsed.data });
  if (moodStamp.channel === 'email') {
    const outcome = await deliverMoodStampByEmail(moodStamp.id, session.user.id);
    if (outcome.record) moodStamp = outcome.record;
  }
  return NextResponse.json({ moodStamp }, { status: 201, headers: { 'cache-control': 'private, no-store' } });
}
