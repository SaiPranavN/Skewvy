import type { Metadata } from 'next';
import { MoodStampNextIteration } from '@/components/moodstamps/MoodStampNextIteration';
import { requireMoodStampsUser } from '@/lib/moodstamps/auth';

export const metadata: Metadata = { title: 'Receive MoodStamps', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ReceiveMoodStampsRoute() {
  await requireMoodStampsUser('/moodstamps/receive');

  return (
    <MoodStampNextIteration
      eyebrow="Receive"
      title="Receive MoodStamps"
      description="Get your personal link and let others send one to you."
    />
  );
}
