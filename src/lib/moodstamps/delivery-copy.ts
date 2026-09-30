import { deliveryErrorMessage, type MoodStampRecord } from './types';

/**
 * What the sender is told about where their MoodStamp is, in one place, so
 * the screen after sending and the stamp's own page never disagree.
 */
export function deliverySummary(record: MoodStampRecord): string {
  if (record.channel === 'download') return 'You downloaded this one to hand over yourself.';
  if (record.channel === 'link') {
    const opened = record.opened ? ' They have opened it.' : ' They have not opened it yet.';
    return `Delivered to ${record.recipientName}’s MoodStamps board, through their MoodStamp link.${opened}`;
  }

  if (record.delivery === 'delivered') {
    const opened = record.opened ? ' They have opened it.' : ' They have not opened it yet.';
    if (record.deliveryRoute === 'inbox') {
      return `Delivered to their MoodStamps inbox on Skewvy. ${record.destination} was already emailed a MoodStamp today, so instead of another email they get one reminder once the day is up.${opened}`;
    }
    return `Emailed to ${record.destination}.${opened}`;
  }

  if (record.channel === 'whatsapp') {
    return `WhatsApp delivery is not switched on yet, so this has not reached ${record.destination} — it is waiting here until it does.`;
  }
  if (record.deliveryError) return deliveryErrorMessage(record.deliveryError);
  return `This has not been emailed to ${record.destination} yet.`;
}

/** An email stamp that has not gone, for a reason sending again could fix. */
export function canSendAgain(record: MoodStampRecord): boolean {
  return (
    record.channel === 'email' &&
    record.delivery === 'awaiting' &&
    record.deliveryError !== 'opted_out' &&
    record.deliveryError !== 'recipient_limit'
  );
}
