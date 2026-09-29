import Link from 'next/link';
import { MoodStampArtwork } from '../MoodStampArtwork';
import { DownloadStampButton } from '../DownloadStampButton';
import type { MoodStampArtworkData } from '@/lib/moodstamps/types';

/**
 * A MoodStamp as the person it was sent to sees it — from the private link in
 * their email, or from their own Received board.
 *
 * The artwork arrives with an anonymous sender's name already replaced on the
 * server; nothing here can reveal who sent it.
 */
export function ReceivedStampView({
  artwork,
  back,
  footer,
}: {
  artwork: MoodStampArtworkData;
  back?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const from = artwork.anonymous ? null : artwork.senderName;

  return (
    <div className="rail page-enter pb-[clamp(56px,7vw,110px)] pt-[clamp(24px,3vw,44px)]">
      {back}
      <div className="mt-2 grid items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-24">
          <p className="eyebrow text-[color:var(--color-violet)]">A MoodStamp for you</p>
          <h1 className="display mt-3 text-[clamp(32px,4vw,54px)]">
            {from ? `${from} sent you a MoodStamp.` : 'Someone sent you a MoodStamp.'}
          </h1>
          <p className="mt-4 max-w-[46ch] text-[16px] leading-relaxed text-secondary">
            A feeling, counted and put into words.{' '}
            {artwork.reaction === 'medal'
              ? 'Medals are appreciation — something you did was noticed.'
              : 'Rotten Eggs are criticism — something needed to be said.'}{' '}
            It is yours to keep.
          </p>
          {artwork.anonymous && (
            <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-tertiary">
              The sender chose to stay anonymous. Skewvy has verified that they hold an account, and does not share who
              they are.
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <DownloadStampButton artwork={artwork} />
            <Link href="/moodstamps/send" className="btn btn-outline min-h-[52px] w-full sm:w-auto">
              Send a MoodStamp
            </Link>
          </div>

          {footer && (
            <p className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--border-subtle)] pt-5 text-[13px] font-semibold text-tertiary">
              {footer}
            </p>
          )}
        </div>

        <div className="mx-auto w-full max-w-[640px]">
          <MoodStampArtwork data={artwork} />
        </div>
      </div>
    </div>
  );
}
