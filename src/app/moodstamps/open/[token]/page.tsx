import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MarkOpened } from '@/components/moodstamps/recipient/MarkOpened';
import { ReceivedStampView } from '@/components/moodstamps/recipient/ReceivedStampView';
import { getMoodStampByToken } from '@/lib/services/moodstamp-delivery';
import { absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Your MoodStamp',
  robots: { index: false, follow: false },
  // The address carries the private token; nothing linked from here should receive it.
  referrer: 'no-referrer',
};
export const dynamic = 'force-dynamic';

/**
 * A MoodStamp, opened from the link in the email it arrived in.
 *
 * No account needed: the link is the key, and it opens this one stamp and
 * nothing else. It is marked opened from the browser, not here, so a mail
 * scanner fetching the link does not count as the recipient.
 */
export default async function OpenMoodStampRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const stamp = await getMoodStampByToken(token);
  if (!stamp) notFound();

  const openUrl = absoluteUrl(`/moodstamps/open/${token}`);

  return (
    <>
      <MarkOpened token={token} />
      <ReceivedStampView
        artwork={stamp.artwork}
        footer={
          <>
            <Link href={`/moodstamps/opt-out/${token}`} className="underline underline-offset-4 hover:text-primary">
              Stop MoodStamps to my email
            </Link>
            <Link
              href={`/report?url=${encodeURIComponent(openUrl)}`}
              className="underline underline-offset-4 hover:text-primary"
            >
              Report this MoodStamp
            </Link>
          </>
        }
      />
    </>
  );
}
