import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { SESSION_COOKIE, resolveSession } from '@/lib/services/sessions';
import { resolveInboxLink } from '@/lib/services/moodstamp-inbox';
import { reviewMoodStamp } from '@/lib/services/moodstamp-review';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { hashIp } from '@/lib/services/crypto';
import { apiError, rateLimited, validationError } from '@/lib/api/responses';
import { requestContext } from '@/lib/api/request-context';
import { moodStampDraftSchema, moodStampLinkSendSchema } from '@/lib/moodstamps/validation';

const PRIVATE = { 'cache-control': 'private, no-store' };

const bodySchema = z.union([
  z.object({ draft: moodStampDraftSchema }),
  z.object({ code: z.string().max(32) }).and(moodStampLinkSendSchema.pick({ draft: true, senderName: true })),
]);

/**
 * Reads a finished MoodStamp before its sender previews it: the word checks
 * first, then the AI review. Answers with the review; nothing is saved but
 * the review itself.
 *
 * Open to the signed-in, for their own stamps, and to anyone writing on an
 * open MoodStamp link — the same people who could send it. Each call can be a
 * paid model call, so it is limited per account or per network address.
 */
export async function POST(request: NextRequest) {
  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);
  const body = await request.json().catch(() => ({}));
  const code = typeof body?.code === 'string' ? body.code : null;

  let recipientName: string | null = null;
  if (code) {
    const link = await resolveInboxLink(code);
    if (!link || link.paused) return apiError(404, 'not_found', 'This MoodStamp link does not work any more.');
    recipientName = link.ownerName;
  } else if (!session) {
    return apiError(401, 'unauthorized', 'Sign in to send a MoodStamp.');
  }

  const senderKey = session ? `user:${session.user.id}` : `ip:${hashIp(requestContext(request).ip) ?? 'unknown'}`;
  const limit = await consumeRateLimit(`moodstamp-review:${senderKey}`, RATE_RULES.moodStampReview);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const draft = parsed.data.draft;
  const guestName = code && !session && !draft.anonymous && 'senderName' in parsed.data ? parsed.data.senderName : null;
  const review = await reviewMoodStamp(
    {
      ...draft,
      recipientName: recipientName ?? ('recipientName' in draft ? draft.recipientName : ''),
      senderName: guestName || null,
    },
    senderKey,
  );
  return NextResponse.json({ review }, { headers: PRIVATE });
}
