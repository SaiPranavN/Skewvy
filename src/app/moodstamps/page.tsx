import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MoodStampsPage } from '@/components/moodstamps/MoodStampsPage';
import { MoodStampsPageSkeleton } from '@/components/moodstamps/MoodStampCardSkeleton';
import { requireMoodStampsUser } from '@/lib/moodstamps/auth';
import { MOODSTAMP_TAGLINE, parseMoodStampView, type MoodStampBoardResult } from '@/lib/moodstamps/types';
import { loadMoodStampBoard } from '@/lib/services/moodstamps';

export const metadata: Metadata = {
  title: 'MoodStamps',
  description: MOODSTAMP_TAGLINE,
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

/*
 * The sign-in check runs before the Suspense boundary, not inside it. Inside
 * — which is where a route `loading.tsx` would put it — the response has
 * already started streaming by the time the check fails, and the redirect
 * degrades to a meta refresh after a flash of skeleton. Out here it is a
 * real 307.
 */
export default async function MoodStampsRoute({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const user = await requireMoodStampsUser(
    parseMoodStampView(view) === 'sent' ? '/moodstamps?view=sent' : '/moodstamps',
  );

  return (
    <Suspense fallback={<MoodStampsPageSkeleton />}>
      <MoodStampBoardLoader userId={user.id} />
    </Suspense>
  );
}

async function MoodStampBoardLoader({ userId }: { userId: string }) {
  // A failed read is shown as a recoverable error on the page, not a crash.
  let initial: MoodStampBoardResult;
  try {
    initial = { status: 'ready', data: await loadMoodStampBoard(userId) };
  } catch (error) {
    console.error('[moodstamps] board failed to load', error);
    initial = { status: 'error' };
  }

  return <MoodStampsPage initial={initial} />;
}
