import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MoodStampArtwork } from '@/components/moodstamps/MoodStampArtwork';
import { StatusBadge } from '@/components/moodstamps/MoodStampCard';
import { DownloadStampButton } from '@/components/moodstamps/DownloadStampButton';
import { requireMoodStampsUser } from '@/lib/moodstamps/auth';
import { artworkFromRecord, formatMoodStampDate, type MoodStampRecord } from '@/lib/moodstamps/types';
import { getMoodStampForSender } from '@/lib/services/moodstamps';

export const metadata: Metadata = { title: 'MoodStamp', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

function deliveryLine(record: MoodStampRecord): string {
  if (record.channel === 'download') return 'You downloaded this one to hand over yourself.';
  const route = record.channel === 'email' ? 'Email' : 'WhatsApp';
  if (record.delivery === 'awaiting') {
    return `${route} delivery is not switched on yet, so this has not reached ${record.destination} — it is waiting here until it does.`;
  }
  return `Delivered by ${route.toLowerCase()} to ${record.destination}.`;
}

/**
 * One MoodStamp, on its own page. Only its sender can open it: anyone else is
 * told there is nothing here, which is also what they would see for an id that
 * never existed.
 */
export default async function MoodStampRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireMoodStampsUser(`/moodstamps/${encodeURIComponent(id)}`);
  const record = await getMoodStampForSender(id, user.id);
  if (!record) notFound();

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
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-secondary">{deliveryLine(record)}</p>
          {record.anonymous && (
            <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-tertiary">
              Signed anonymously: they will see “Anonymous”, and that Skewvy verified the sender.
            </p>
          )}
          <p className="mt-3 text-[13.5px] font-semibold text-tertiary">Receipt {record.receiptCode}</p>
          <div className="mt-8">
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
