import { NextResponse, type NextRequest } from 'next/server';
import { commentVoteSchema } from '@/lib/validation/schemas';
import { voteOnComment } from '@/lib/services/comments';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { SESSION_COOKIE, resolveSession } from '@/lib/services/sessions';
import { apiError, validationError, rateLimited } from '@/lib/api/responses';

/**
 * A like or dislike on one comment.
 *
 * Unlike a reaction, this is not a stance and is not permanent: sending the
 * vote already held withdraws it, and sending the opposite switches sides.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return apiError(401, 'unauthenticated', 'Sign in to vote on a comment.');

  const parsed = commentVoteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);

  const limit = await consumeRateLimit(`comment-vote:${session.user.id}`, RATE_RULES.commentVote);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const result = await voteOnComment({ userId: session.user.id, commentId: id, value: parsed.data.value });
  if (!result) return apiError(404, 'comment_not_found', 'That comment is no longer here.');

  return NextResponse.json(result);
}
