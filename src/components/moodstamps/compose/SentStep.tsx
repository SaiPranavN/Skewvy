'use client';

import Link from 'next/link';
import { useState } from 'react';
import { downloadMoodStamp } from '@/lib/client/moodstamp-image';
import { artworkFromRecord, deliveryErrorMessage, moodStampHref, type MoodStampRecord } from '@/lib/moodstamps/types';
import { DeliverNowButton } from '../DeliverNowButton';
import { MoodStampArtwork } from '../MoodStampArtwork';

/**
 * After sending: what happened, in plain words, and where the stamp is now.
 * A stamp waiting for delivery is never described as delivered.
 */
export function SentStep({
  record,
  onRecordChange,
  onSendAnother,
}: {
  record: MoodStampRecord;
  onRecordChange: (record: MoodStampRecord) => void;
  onSendAnother: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);

  const download = async () => {
    setDownloading(true);
    setDownloadFailed(false);
    const ok = await downloadMoodStamp(artworkFromRecord(record));
    setDownloadFailed(!ok);
    setDownloading(false);
  };

  const summary =
    record.channel === 'download'
      ? 'The image has been downloaded, and the MoodStamp is saved on your Sent board.'
      : record.delivery === 'delivered'
        ? `Delivered to ${record.destination}. It will show as Opened on your Sent board once they open it.`
        : record.channel === 'email' && record.deliveryError
          ? deliveryErrorMessage(record.deliveryError)
          : record.channel === 'whatsapp'
            ? `WhatsApp delivery is not switched on yet, so it has not gone to ${record.destination}. It is saved on your Sent board as Awaiting delivery.`
            : 'It is saved on your Sent board and waiting to be sent.';
  const canRetry =
    record.channel === 'email' &&
    record.delivery === 'awaiting' &&
    record.deliveryError !== 'opted_out' &&
    record.deliveryError !== 'recipient_limit';

  return (
    <div className="grid max-w-[1080px] items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
      <div>
        <p className="text-[16px] leading-relaxed text-secondary">{summary}</p>
        <p className="mt-3 text-[14px] font-semibold text-tertiary">Receipt {record.receiptCode}</p>

        {canRetry && (
          <div className="mt-6">
            <DeliverNowButton id={record.id} label="Try sending again" onDelivered={onRecordChange} />
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={download} disabled={downloading} className="ms-key ms-cta w-full sm:w-auto">
            {downloading ? 'Preparing…' : record.channel === 'download' ? 'Download again' : 'Download image'}
          </button>
          <Link href={moodStampHref(record.id)} className="btn btn-outline min-h-[52px] w-full sm:w-auto">
            Open it
          </Link>
        </div>
        {downloadFailed && (
          <p role="alert" className="mt-3 text-[13.5px] font-semibold text-[color:var(--color-egg)]">
            The image could not be made in this browser. Try again, or open it and take a screenshot.
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--border-subtle)] pt-5 text-[14px] font-bold">
          <Link href="/moodstamps?view=sent" className="policy-link">
            Your Sent board
          </Link>
          <button type="button" onClick={onSendAnother} className="policy-link">
            Send another
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[460px]">
        <MoodStampArtwork data={artworkFromRecord(record)} />
      </div>
    </div>
  );
}
