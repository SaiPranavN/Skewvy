import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { SESSION_COOKIE, resolveSession } from '@/lib/services/sessions';
import { ensureInboxLink, updateInboxLink } from '@/lib/services/moodstamp-inbox';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { apiError, rateLimited, validationError } from '@/lib/api/responses';

const PRIVATE = { 'cache-control': 'private, no-store' };

const changeSchema = z
  .object({ paused: z.boolean().optional(), notify: z.boolean().optional(), renew: z.literal(true).optional() })
  .refine((change) => Object.keys(change).length > 0, 'Nothing to change.');

/** The signed-in person's own MoodStamp link, made the first time it is asked for. */
export async function GET(request: NextRequest) {
  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return apiError(401, 'unauthorized', 'Sign in to get your MoodStamp link.');
  return NextResponse.json({ link: await ensureInboxLink(session.user.id) }, { headers: PRIVATE });
}

/**
 * Pauses or resumes the link, turns the arrival email on or off, or replaces
 * the link with a new one. Whose link it is comes from the session alone.
 */
export async function PATCH(request: NextRequest) {
  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return apiError(401, 'unauthorized', 'Sign in to manage your MoodStamp link.');

  const limit = await consumeRateLimit(`moodstamp-link-manage:${session.user.id}`, RATE_RULES.moodStampLinkManage);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const parsed = changeSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);

  await ensureInboxLink(session.user.id);
  const link = await updateInboxLink(session.user.id, parsed.data);
  return NextResponse.json({ link }, { headers: PRIVATE });
}
