/**
 * MoodStamps: a feeling, counted and sent to one person.
 *
 * These types are shared by the server loader, the API and the board UI, so
 * they carry nothing that is not safe to hand to the signed-in person — every
 * record here is one they sent or one they received.
 */

/** Which side of the board is showing. */
export type MoodStampView = 'received' | 'sent';

export const MOODSTAMP_VIEWS: readonly MoodStampView[] = ['received', 'sent'];

/** Medals for appreciation, Rotten Eggs for criticism. */
export type MoodStampReaction = 'medal' | 'rotten_egg';

export interface MoodStampSummary {
  id: string;
  direction: MoodStampView;
  /** The emotion word, as the sender chose it — "Proud", "Fed up". */
  emotion: string;
  reaction: MoodStampReaction;
  /** How many Medals or Rotten Eggs: the intensity of the feeling. */
  quantity: number;
  /**
   * The other person: the sender on a received stamp, the recipient on a sent
   * one. Null only when a received stamp's sender chose to stay anonymous.
   */
  counterpartName: string | null;
  /** The sender's name is hidden — from the recipient, and on the sender's own copy it says so. */
  anonymous: boolean;
  /** When it was sent (sent view) or delivered (received view). ISO 8601. */
  occurredAt: string;
  /** Whether the recipient has opened it. */
  opened: boolean;
  /**
   * Where a sent stamp stands. An emailed stamp is 'delivered' once the email
   * has gone; WhatsApp delivery is not switched on yet, so those wait as
   * 'awaiting'; a downloaded stamp was handed over by the sender themselves.
   * Received stamps are always 'delivered'.
   */
  delivery: MoodStampDeliveryState;
  /** Why the last delivery attempt did not go through, while it is still waiting. */
  deliveryError: MoodStampDeliveryError | null;
  /** The rendered artwork, once artwork generation exists. */
  artworkUrl: string | null;
}

export type MoodStampChannel = 'email' | 'whatsapp' | 'download';
export type MoodStampDeliveryState = 'awaiting' | 'downloaded' | 'delivered';
export type MoodStampDeliveryError = 'opted_out' | 'recipient_limit' | 'send_failed' | 'not_configured';
/** How a delivered email stamp reached them: its own email, or held in their Skewvy inbox. */
export type MoodStampDeliveryRoute = 'email' | 'inbox';

/** What the sender is told when an email did not go out, and what they can do. */
export function deliveryErrorMessage(error: MoodStampDeliveryError): string {
  switch (error) {
    case 'opted_out':
      return 'This address has asked not to receive MoodStamps, so it was not sent. You can still download it and hand it over yourself.';
    case 'recipient_limit':
      return 'You have already sent this person three MoodStamps today. Try again tomorrow.';
    case 'not_configured':
      return 'Email delivery is not available right now. Try again later.';
    case 'send_failed':
      return 'The email did not go through. Nothing was sent — try again.';
  }
}

/** Everything printed on a stamp. Drawn the same by the page and the downloaded image. */
export interface MoodStampArtworkData {
  reaction: MoodStampReaction;
  emotion: string;
  quantity: number;
  /** The sender's name as printed, whether or not it is shown. */
  senderName: string;
  anonymous: boolean;
  recipientName: string;
  reasons: [string, string, string];
  /** Assigned when the stamp is sent; null on a preview. */
  receiptCode: string | null;
  /** ISO 8601. The day it was sent, or today on a preview. */
  date: string;
  /** What the badge row says about it. */
  state: 'preview' | 'sent' | 'unopened' | 'opened';
}

/** A stamp as its sender sees it, on its own page. */
export interface MoodStampRecord extends MoodStampSummary {
  receiptCode: string;
  senderName: string;
  recipientName: string;
  reasons: [string, string, string];
  channel: MoodStampChannel;
  /** The address it is going to: shown back to the sender only. */
  destination: string | null;
  /** For a delivered email stamp: whether it was emailed, or held in their Skewvy inbox. */
  deliveryRoute: MoodStampDeliveryRoute | null;
}

export function artworkFromRecord(record: MoodStampRecord): MoodStampArtworkData {
  return {
    reaction: record.reaction,
    emotion: record.emotion,
    quantity: record.quantity,
    senderName: record.senderName,
    anonymous: record.anonymous,
    recipientName: record.recipientName,
    reasons: record.reasons,
    receiptCode: record.receiptCode,
    date: record.occurredAt,
    state: record.delivery === 'delivered' ? (record.opened ? 'opened' : 'unopened') : 'sent',
  };
}

export interface MoodStampCounts {
  received: number;
  sent: number;
}

export interface MoodStampBoardData {
  received: MoodStampSummary[];
  sent: MoodStampSummary[];
  counts: MoodStampCounts;
}

/** What the server hands the page: the board, or the fact that it could not be read. */
export type MoodStampBoardResult = { status: 'ready'; data: MoodStampBoardData } | { status: 'error' };

/** Anything that is not exactly "sent" is the default view. */
export function parseMoodStampView(value: string | string[] | null | undefined): MoodStampView {
  return value === 'sent' ? 'sent' : 'received';
}

export function moodStampBoardHref(view: MoodStampView): string {
  return `/moodstamps?view=${view}`;
}

/** Where a single MoodStamp will open. The page arrives with real records. */
export function moodStampHref(id: string): string {
  return `/moodstamps/${encodeURIComponent(id)}`;
}

export const MOODSTAMP_TAGLINE = 'MoodStamp turns a feeling into something you can actually send.';

export function reactionLabel(reaction: MoodStampReaction, quantity: number): string {
  if (reaction === 'medal') return quantity === 1 ? 'Medal' : 'Medals';
  return quantity === 1 ? 'Rotten Egg' : 'Rotten Eggs';
}

export function reactionIntent(reaction: MoodStampReaction): string {
  return reaction === 'medal' ? 'Appreciation' : 'Criticism';
}

/** A fixed, timezone-independent date, so server and client render the same text. */
export function formatMoodStampDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
}
