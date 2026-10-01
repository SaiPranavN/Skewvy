import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, resolveSession } from '@/lib/services/sessions';
import { createLinkMoodStamp, resolveInboxLink } from '@/lib/services/moodstamp-inbox';
import { sweepRemindersSoon } from '@/lib/services/moodstamp-delivery';
import { blockedFields, reviewMoodStamp } from '@/lib/services/moodstamp-review';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { verifyTurnstile, turnstileUnavailable, TURNSTILE_UNAVAILABLE_MESSAGE } from '@/lib/services/turnstile';
import { hashIp } from '@/lib/services/crypto';
import { apiError, rateLimited, validationError } from '@/lib/api/responses';
import { requestContext } from '@/lib/api/request-context';
import { moodStampLinkSendSchema } from '@/lib/moodstamps/validation';

const PRIVATE = { 'cache-control': 'private, no-store' };

/**
 * Sends a MoodStamp through someone's link. No account needed.
 *
 * Because anyone can, it is held tighter than a signed-in send: the same
 * language checks, a robot check for anyone without an account, a limit per
 * sender (their account, or their network address), a limit on how many one
 * sender can send one person a day, and a ceiling on what one link can take
 * in a day. A paused or replaced link takes nothing.
 *
 * The stamp is on the owner's board the moment this returns; the owner is
 * emailed about it at most once a day, after the response has gone.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { ip } = requestContext(request);
  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);
  const senderKey = session ? `user:${session.user.id}` : `ip:${hashIp(ip) ?? 'unknown'}`;

  const burst = await consumeRateLimit(`moodstamp-link-send:${senderKey}`, RATE_RULES.moodStampLinkSend);
  if (!burst.allowed) return rateLimited(burst.retryAfterSeconds);

  const link = await resolveInboxLink(code);
  if (!link) return apiError(404, 'not_found', 'This MoodStamp link does not work any more.');
  if (link.paused) return apiError(409, 'paused', `${link.ownerName} is not taking MoodStamps right now.`);
  if (session?.user.id === link.ownerId) {
    return apiError(400, 'own_link', 'This is your own link. Share it, and other people can send you MoodStamps.');
  }

  const parsed = moodStampLinkSendSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);
  const { draft, senderName, turnstileToken, website } = parsed.data;
  if (website) return apiError(400, 'rejected', 'That did not go through. Check the form and try again.');

  if (!session) {
    if (!draft.anonymous && !senderName) {
      return apiError(422, 'validation_failed', 'Some details need another look.', {
        fields: { senderName: 'Add your name, or send it anonymously.' },
      });
    }
    const turnstile = await verifyTurnstile(turnstileToken, ip);
    if (!turnstile.success) {
      return turnstileUnavailable(turnstile)
        ? apiError(400, 'turnstile_unavailable', TURNSTILE_UNAVAILABLE_MESSAGE)
        : apiError(400, 'turnstile_failed', 'The robot check did not pass. Try it again.');
    }
  }

  // The AI review, answered from the one made at Preview when nothing has changed.
  const guestName = !session && !draft.anonymous ? senderName : null;
  const review = await reviewMoodStamp({ ...draft, recipientName: link.ownerName, senderName: guestName }, senderKey);
  if (review.verdict === 'block') {
    return apiError(422, 'review_blocked', review.message, { fields: blockedFields(review) });
  }

  const pair = await consumeRateLimit(`moodstamp-link-pair:${senderKey}:${link.ownerId}`, RATE_RULES.moodStampLinkPair);
  if (!pair.allowed) {
    return apiError(429, 'recipient_limit', `You have already sent ${link.ownerName} three MoodStamps today.`, {
      retryAfterSeconds: pair.retryAfterSeconds,
    });
  }
  const daily = await consumeRateLimit(`moodstamp-link-daily:${link.ownerId}`, RATE_RULES.moodStampLinkDaily);
  if (!daily.allowed) {
    return apiError(429, 'link_full', `${link.ownerName} has had a lot of MoodStamps today. Try again tomorrow.`, {
      retryAfterSeconds: daily.retryAfterSeconds,
    });
  }

  const moodStamp = await createLinkMoodStamp({
    link,
    draft: { ...draft, recipientName: link.ownerName },
    sender: session
      ? { kind: 'account', user: session.user }
      : { kind: 'guest', name: guestName },
  });
  sweepRemindersSoon();
  return NextResponse.json({ moodStamp }, { status: 201, headers: PRIVATE });
}
