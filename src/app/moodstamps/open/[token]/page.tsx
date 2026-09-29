import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MoodStampArtwork } from '@/components/moodstamps/MoodStampArtwork';
import { DownloadStampButton } from '@/components/moodstamps/DownloadStampButton';
import { MarkOpened } from '@/components/moodstamps/recipient/MarkOpened';
import { senderLabel } from '@/lib/moodstamps/email';
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
 * A MoodStamp, opened by the person it was sent to.
 *
 * No account needed: the link in their email is the key, and it opens this
 * one stamp and nothing else. What it says about the sender is only what the
 * stamp prints — an anonymous sender stays anonymous here too.
 */
export default async function OpenMoodStampRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const stamp = await getMoodStampByToken(token);
  if (!stamp) notFound();

  const from = senderLabel(stamp.artwork);
  const openUrl = absoluteUrl(`/moodstamps/open/${token}`);

  return (
    <div className="rail page-enter pb-[clamp(56px,7vw,110px)] pt-[clamp(24px,3vw,44px)]">
      <MarkOpened token={token} />

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-24">
          <p className="eyebrow text-[color:var(--color-violet)]">A MoodStamp for you</p>
          <h1 className="display mt-3 text-[clamp(32px,4vw,54px)]">
            {from ? `${from} sent you a MoodStamp.` : 'Someone sent you a MoodStamp.'}
          </h1>
          <p className="mt-4 max-w-[46ch] text-[16px] leading-relaxed text-secondary">
            A feeling, counted and put into words.{' '}
            {stamp.artwork.reaction === 'medal'
              ? 'Medals are appreciation — something you did was noticed.'
              : 'Rotten Eggs are criticism — something needed to be said.'}{' '}
            It is yours to keep.
          </p>
          {stamp.artwork.anonymous && (
            <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-tertiary">
              The sender chose to stay anonymous. Skewvy has verified that they hold an account, and does not share who
              they are.
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <DownloadStampButton artwork={stamp.artwork} />
            <Link href="/moodstamps/send" className="btn btn-outline min-h-[52px] w-full sm:w-auto">
              Send a MoodStamp
            </Link>
          </div>

          <p className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--border-subtle)] pt-5 text-[13px] font-semibold text-tertiary">
            <Link href={`/moodstamps/opt-out/${token}`} className="underline underline-offset-4 hover:text-primary">
              Stop MoodStamps to my email
            </Link>
            <Link
              href={`/report?url=${encodeURIComponent(openUrl)}`}
              className="underline underline-offset-4 hover:text-primary"
            >
              Report this MoodStamp
            </Link>
          </p>
        </div>

        <div className="mx-auto w-full max-w-[640px]">
          <MoodStampArtwork data={stamp.artwork} />
        </div>
      </div>
    </div>
  );
}
