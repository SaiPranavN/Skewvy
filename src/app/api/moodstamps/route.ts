import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, resolveSession } from '@/lib/services/sessions';
import { loadMoodStampBoard } from '@/lib/services/moodstamps';
import { apiError } from '@/lib/api/responses';

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
