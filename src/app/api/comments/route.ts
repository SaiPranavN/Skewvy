import { NextResponse, type NextRequest } from 'next/server';
import { commentInputSchema } from '@/lib/validation/schemas';
import { createComment, listComments, type CommentSort } from '@/lib/services/comments';
import { artifactIsReactable } from '@/lib/services/reactions';
import { consumeRateLimit, RATE_RULES } from '@/lib/services/rate-limit';
import { SESSION_COOKIE, resolveSession } from '@/lib/services/sessions';
import { apiError, validationError, rateLimited } from '@/lib/api/responses';
import type { ArtifactType } from '@/lib/domain/types';

/**
 * The discussion endpoint.
 *
 * Reading is open to everyone. Posting needs an account — a comment carries a
 * name and can be voted on, so it needs an owner — but nothing more: having
 * reacted is not a condition, and the side someone took never is.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const artifactType = params.get('artifactType');
  const artifactId = params.get('artifactId');

  if (artifactType !== 'entity' && artifactType !== 'flash_news') {
    return apiError(400, 'bad_request', 'Unknown artifact type.');
  }
  if (!artifactId) return apiError(400, 'bad_request', 'Missing artifact id.');

  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);
  const sort: CommentSort = params.get('sort') === 'top' ? 'top' : 'new';
  const offset = Number.parseInt(params.get('offset') ?? '0', 10);

  const page = await listComments(artifactType as ArtifactType, artifactId, {
    viewerId: session?.user.id ?? null,
    viewerIsAdmin: session?.user.isAdmin ?? false,
    sort,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  return NextResponse.json(page);
}

export async function POST(request: NextRequest) {
  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return apiError(401, 'unauthenticated', 'Sign in to join the discussion.');
  }

  const parsed = commentInputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);

  const limit = await consumeRateLimit(`comment:${session.user.id}`, RATE_RULES.commentPost);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const { artifactType, artifactId, body } = parsed.data;
  if (!(await artifactIsReactable(artifactType, artifactId))) {
    return apiError(404, 'artifact_not_found', 'That page is no longer open for discussion.');
  }

  const comment = await createComment({ userId: session.user.id, artifactType, artifactId, body });
  return NextResponse.json({ comment }, { status: 201 });
}
