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
  /** The rendered artwork, once artwork generation exists. */
  artworkUrl: string | null;
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
