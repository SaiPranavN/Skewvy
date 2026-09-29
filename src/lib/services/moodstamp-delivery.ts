import { execute, query } from '@/lib/db';
import { renderMoodStampEmail } from '@/lib/moodstamps/email';
import {
  artworkFromRecord,
  type MoodStampArtworkData,
  type MoodStampDeliveryError,
  type MoodStampRecord,
} from '@/lib/moodstamps/types';
import { absoluteUrl } from '@/lib/site';
import { generateToken, hashToken } from './crypto';
import { emailDeliveryConfigured, sendEmail } from './email';
import { getMoodStampForSender, toRecord, COLUMNS, type MoodStampRow } from './moodstamps';
import { consumeRateLimit, RATE_RULES } from './rate-limit';

/**
 * Delivering MoodStamps by email, and everything the recipient can do with
 * the one they got: open it, and ask for no more.
 *
 * The recipient is not a Skewvy account. They reach their stamp through a
 * private link in the email, whose token is stored only as a hash, and which
 * shows that one stamp and nothing else about the sender.
 */

/** How long one attempt holds the stamp, so a double click cannot send it twice. */
const CLAIM_SECONDS = 60;

export type DeliveryOutcome =
  | { status: 'delivered'; record: MoodStampRecord }
  | { status: 'failed'; error: MoodStampDeliveryError; record: MoodStampRecord }
  | { status: 'skipped'; record: MoodStampRecord | null };

function emailHash(email: string): string {
  return hashToken(`moodstamp-optout:${email.trim().toLowerCase()}`);
}

export async function isOptedOut(email: string): Promise<boolean> {
  const rows = await query<{ email_hash: string }>('SELECT email_hash FROM moodstamp_optouts WHERE email_hash = $1', [
    emailHash(email),
  ]);
  return rows.length > 0;
}

async function fail(id: string, error: MoodStampDeliveryError): Promise<void> {
  // The claim is released so the sender can try again at once.
  await execute('UPDATE moodstamps SET delivery_error = $1, delivery_attempted_at = NULL WHERE id = $2', [error, id]);
}

/**
 * Emails a MoodStamp to its recipient.
 *
 * Only the sender can ask, only for an email stamp that has not gone out yet,
 * and only one attempt runs at a time — the stamp is claimed with a
 * conditional update before anything is sent. Before sending it checks that
 * the address has not opted out and has not already been sent too many
 * MoodStamps today; either stops it with a reason the sender is shown.
 */
export async function deliverMoodStampByEmail(id: string, senderId: string): Promise<DeliveryOutcome> {
  const now = new Date();
  const claimed = await query<{ recipient_email: string | null }>(
    `UPDATE moodstamps SET delivery_attempted_at = $1
      WHERE id = $2 AND sender_id = $3 AND channel = 'email' AND delivery_status = 'awaiting'
        AND (delivery_attempted_at IS NULL OR delivery_attempted_at < $4)
      RETURNING recipient_email`,
    [now.toISOString(), id, senderId, new Date(now.getTime() - CLAIM_SECONDS * 1000).toISOString()],
  );

  const current = async () => getMoodStampForSender(id, senderId);
  if (claimed.length === 0) return { status: 'skipped', record: await current() };

  const recipient = claimed[0].recipient_email;
  const stop = async (error: MoodStampDeliveryError): Promise<DeliveryOutcome> => {
    await fail(id, error);
    return { status: 'failed', error, record: (await current())! };
  };

  // Without a provider the dev transport only pretends; in production that would be a lie.
  if (!recipient || (process.env.NODE_ENV === 'production' && !emailDeliveryConfigured())) {
    return stop('not_configured');
  }
  if (await isOptedOut(recipient)) return stop('opted_out');

  const limit = await consumeRateLimit(`moodstamp-to:${emailHash(recipient)}`, RATE_RULES.moodStampToRecipient);
  if (!limit.allowed) return stop('recipient_limit');

  const record = (await current())!;
  const token = generateToken(24);
  await execute('INSERT INTO moodstamp_links (token_hash, moodstamp_id, created_at) VALUES ($1, $2, $3)', [
    hashToken(token),
    id,
    now.toISOString(),
  ]);

  const openUrl = absoluteUrl(`/moodstamps/open/${token}`);
  const email = renderMoodStampEmail({
    data: { ...artworkFromRecord(record), date: now.toISOString(), state: 'unopened' },
    openUrl,
    optOutUrl: absoluteUrl(`/moodstamps/opt-out/${token}`),
    oneClickOptOutUrl: absoluteUrl(`/api/moodstamps/opt-out?token=${token}`),
    reportUrl: absoluteUrl(`/report?url=${encodeURIComponent(openUrl)}`),
  });

  try {
    const sent = await sendEmail({ to: recipient, ...email });
    await execute(
      `UPDATE moodstamps
          SET delivery_status = 'delivered', delivered_at = $1, provider_message_id = $2, delivery_error = NULL
        WHERE id = $3`,
      [new Date().toISOString(), sent.id, id],
    );
    return { status: 'delivered', record: (await current())! };
  } catch (error) {
    console.error('[moodstamps] email delivery failed', { id, error });
    return stop('send_failed');
  }
}

/** A stamp as its recipient sees it. */
export interface ReceivedMoodStamp {
  artwork: MoodStampArtworkData;
  opened: boolean;
}

async function stampForToken(token: string): Promise<MoodStampRow | null> {
  if (!token || token.length < 16 || token.length > 128) return null;
  const rows = await query<MoodStampRow>(
    `SELECT ${COLUMNS.split(',')
      .map((column) => `m.${column.trim()}`)
      .join(', ')}
       FROM moodstamp_links l JOIN moodstamps m ON m.id = l.moodstamp_id
      WHERE l.token_hash = $1 AND m.delivery_status = 'delivered'`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
}

/**
 * The stamp behind a recipient's link, or null.
 *
 * An anonymous sender's name is replaced before it leaves the server: the
 * page hands the stamp to client components for the download, and anything
 * handed to the client can be read by the person holding it.
 */
export async function getMoodStampByToken(token: string): Promise<ReceivedMoodStamp | null> {
  const row = await stampForToken(token);
  if (!row) return null;
  const record = toRecord(row);
  const artwork = artworkFromRecord(record);
  return {
    artwork: {
      ...artwork,
      senderName: record.anonymous ? 'Anonymous' : record.senderName,
      date: record.occurredAt,
      state: 'opened',
    },
    opened: record.opened,
  };
}

/** The first time the recipient opens it. Later opens change nothing. */
export async function markMoodStampOpened(token: string): Promise<boolean> {
  const row = await stampForToken(token);
  if (!row) return false;
  if (!row.opened_at) {
    await execute('UPDATE moodstamps SET opened_at = $1 WHERE id = $2 AND opened_at IS NULL', [
      new Date().toISOString(),
      row.id,
    ]);
  }
  return true;
}

/** Stops every future MoodStamp email to the address this link was sent to. */
export async function optOutByToken(token: string): Promise<boolean> {
  if (!token || token.length < 16 || token.length > 128) return false;
  const rows = await query<{ recipient_email: string | null }>(
    `SELECT m.recipient_email FROM moodstamp_links l JOIN moodstamps m ON m.id = l.moodstamp_id WHERE l.token_hash = $1`,
    [hashToken(token)],
  );
  const email = rows[0]?.recipient_email;
  if (!email) return false;

  await execute(
    'INSERT INTO moodstamp_optouts (email_hash, created_at) VALUES ($1, $2) ON CONFLICT (email_hash) DO NOTHING',
    [emailHash(email), new Date().toISOString()],
  );
  return true;
}

/** Whether a recipient link is one Skewvy sent. */
export async function recipientLinkExists(token: string): Promise<boolean> {
  if (!token || token.length < 16 || token.length > 128) return false;
  const rows = await query<{ token_hash: string }>('SELECT token_hash FROM moodstamp_links WHERE token_hash = $1', [
    hashToken(token),
  ]);
  return rows.length > 0;
}
