import type { MoodStampBoardData } from '@/lib/moodstamps/types';

/**
 * The signed-in person's MoodStamp board: what they received and what they sent.
 *
 * Always keyed by the session's own user id — never by anything taken from a
 * URL or a request body — so one person's board can never be asked for by
 * another.
 *
 * Nothing can be sent yet: creation arrives in the next iteration, and with it
 * the table this will read. Until then every board is honestly empty. Nothing
 * is invented to fill it; a record shown here must be a real one.
 */
export async function loadMoodStampBoard(userId: string): Promise<MoodStampBoardData> {
  if (!userId) throw new Error('A MoodStamp board belongs to a signed-in person.');

  return {
    received: [],
    sent: [],
    counts: { received: 0, sent: 0 },
  };
}
