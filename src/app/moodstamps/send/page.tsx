import type { Metadata } from 'next';
import { MoodStampNextIteration } from '@/components/moodstamps/MoodStampNextIteration';
import { requireMoodStampsUser } from '@/lib/moodstamps/auth';

export const metadata: Metadata = { title: 'Send a MoodStamp', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function SendMoodStampRoute() {
  await requireMoodStampsUser('/moodstamps/send');

  return (
    <MoodStampNextIteration
      eyebrow="Send"
      title="Send a MoodStamp"
      description="Turn appreciation or criticism into something someone can keep."
    />
  );
}
