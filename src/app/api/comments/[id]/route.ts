import { NextResponse, type NextRequest } from 'next/server';
import { deleteComment } from '@/lib/services/comments';
import { SESSION_COOKIE, resolveSession } from '@/lib/services/sessions';
import { apiError } from '@/lib/api/responses';

/** Removes a comment. Authors may remove their own; admins may remove any. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return apiError(401, 'unauthenticated', 'Sign in first.');

  const outcome = await deleteComment({
    commentId: id,
    userId: session.user.id,
    isAdmin: session.user.isAdmin,
  });

  if (outcome === 'not_found') return apiError(404, 'comment_not_found', 'That comment is no longer here.');
  if (outcome === 'forbidden') return apiError(403, 'forbidden', 'You can only remove your own comments.');

  return NextResponse.json({ deleted: true });
}
