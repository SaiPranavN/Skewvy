import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MoodStampArtwork } from '@/components/moodstamps/MoodStampArtwork';
import { StatusBadge } from '@/components/moodstamps/MoodStampCard';
import { DownloadStampButton } from '@/components/moodstamps/DownloadStampButton';
import { requireMoodStampsUser } from '@/lib/moodstamps/auth';
import { artworkFromRecord, formatMoodStampDate } from '@/lib/moodstamps/types';
import { canSendAgain, deliverySummary } from '@/lib/moodstamps/delivery-copy';
import { DeliverNowButton } from '@/components/moodstamps/DeliverNowButton';
import { ReceivedStampView } from '@/components/moodstamps/recipient/ReceivedStampView';
import { getMoodStampForSender, openReceivedMoodStamp, receivingAddress } from '@/lib/services/moodstamps';

export const metadata: Metadata = { title: 'MoodStamp', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * One MoodStamp, on its own page — for the two people it belongs to.
 *
 * Its sender sees where it went. The person it was sent to — signed in with
 * the verified address it was sent to, or the owner of the link it was
 * written on — sees it as theirs, and opening it here marks it opened. Anyone else is told there is nothing here, which is also
 * what they would see for an id that never existed.
 */
export default async function MoodStampRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireMoodStampsUser(`/moodstamps/${encodeURIComponent(id)}`);
  const record = await getMoodStampForSender(id, user.id);

  if (!record) {
    const received = await openReceivedMoodStamp(id, receivingAddress(user), user.id);
    if (!received) notFound();
    return (
      <ReceivedStampView
        artwork={received.artwork}
        back={
          <Link
            href="/moodstamps?view=received"
            className="inline-flex min-h-11 items-center gap-2 text-[13px] font-bold text-secondary transition-colors duration-150 hover:text-primary"
          >
            <span aria-hidden="true">←</span> Your Received board
          </Link>
        }
      />
    );
  }

  return (
    <div className="rail page-enter pb-[clamp(56px,7vw,110px)] pt-[clamp(24px,3vw,44px)]">
      <Link
        href="/moodstamps?view=sent"
        className="inline-flex min-h-11 items-center gap-2 text-[13px] font-bold text-secondary transition-colors duration-150 hover:text-primary"
      >
        <span aria-hidden="true">←</span> Your Sent board
      </Link>

      <div className="mt-6 grid items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-24">
          <p className="eyebrow text-[color:var(--color-violet)]">Sent MoodStamp</p>
          <h1 className="display mt-3 text-[clamp(32px,4vw,54px)]">To {record.recipientName}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="bg-[var(--color-paper)] p-1">
              <StatusBadge stamp={record} />
            </span>
            <span className="text-[14px] font-semibold text-secondary">Sent {formatMoodStampDate(record.occurredAt)}</span>
          </div>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-secondary">{deliverySummary(record)}</p>
          {record.anonymous && (
            <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-tertiary">
              Signed anonymously: they will see “Anonymous”, and that Skewvy verified the sender.
            </p>
          )}
          <p className="mt-3 text-[13.5px] font-semibold text-tertiary">Receipt {record.receiptCode}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
            {canSendAgain(record) && (
              <DeliverNowButton id={record.id} label={record.deliveryError ? 'Try sending again' : 'Send it now'} />
            )}
            <DownloadStampButton artwork={artworkFromRecord(record)} />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[640px]">
          <MoodStampArtwork data={artworkFromRecord(record)} />
        </div>
      </div>
    </div>
  );
}
