import { NextResponse, type NextRequest } from 'next/server';
import { commentReportSchema } from '@/lib/validation/schemas';
import { reportComment } from '@/lib/services/comments';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { SESSION_COOKIE, resolveSession } from '@/lib/services/sessions';
import { apiError, validationError, rateLimited } from '@/lib/api/responses';

/**
 * Flags a comment for review.
 *
 * Reporting twice is not an error — the answer is the same "we have it" — so a
 * double tap or a retry after a dropped response cannot confuse the person
 * into thinking the first one was lost.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return apiError(401, 'unauthenticated', 'Sign in to report a comment.');

  const parsed = commentReportSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);

  const limit = await consumeRateLimit(`comment-report:${session.user.id}`, RATE_RULES.commentReport);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const outcome = await reportComment({
    userId: session.user.id,
    commentId: id,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
  });

  if (outcome === 'not_found') return apiError(404, 'comment_not_found', 'That comment is no longer here.');
  if (outcome === 'own_comment') {
    return apiError(403, 'own_comment', 'You cannot report your own comment. You can delete it instead.');
  }

  return NextResponse.json({ reported: true, alreadyReported: outcome === 'already_reported' });
}
