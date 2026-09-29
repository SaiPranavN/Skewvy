import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MoodStampComposer } from '@/components/moodstamps/compose/MoodStampComposer';
import { requireMoodStampsUser } from '@/lib/moodstamps/auth';

export const metadata: Metadata = { title: 'Send a MoodStamp', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function SendMoodStampRoute() {
  const user = await requireMoodStampsUser('/moodstamps/send');

  return (
    <Suspense fallback={null}>
      <MoodStampComposer senderName={user.displayName} />
    </Suspense>
  );
}
