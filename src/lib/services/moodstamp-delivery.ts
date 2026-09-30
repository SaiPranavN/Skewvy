import { after } from 'next/server';
import { execute, query } from '@/lib/db';
import { renderMoodStampEmail, renderReminderEmail } from '@/lib/moodstamps/email';
import { artworkFromRecord, type MoodStampDeliveryError, type MoodStampRecord } from '@/lib/moodstamps/types';
import { absoluteUrl, SITE_URL } from '@/lib/site';
import { generateToken, hashToken } from './crypto';
import { emailDeliveryConfigured, sendEmail } from './email';
import {
  COLUMNS,
  getMoodStampForSender,
  receivedArtwork,
  type MoodStampRow,
  type ReceivedMoodStamp,
} from './moodstamps';
import { consumeRateLimit, RATE_RULES } from './rate-limit';

/**
 * Getting MoodStamps to the people they are for, without flooding them.
 *
 * An address is emailed at most once a day. The first MoodStamp sent to it
 * arrives as its own email. Any more that day are delivered to the address's
 * MoodStamps inbox on Skewvy instead — the Received board of the account that
 * holds that address, or, until someone creates that account, a waiting
 * inbox for whoever proves they own it. Once the day is up, the address gets
 * one reminder that they are waiting, and the clock starts again.
 *
 * The recipient never needs an account for the first one: the email carries
 * a private link, stored only as a hash, that opens that stamp and nothing
 * else.
 */

/** How long one attempt holds a stamp, so a double click cannot send it twice. */
const CLAIM_SECONDS = 60;

/** One email a day, per address, of either kind. */
export const EMAIL_GAP_HOURS = 24;

export type DeliveryOutcome =
  | { status: 'delivered'; record: MoodStampRecord }
  | { status: 'failed'; error: MoodStampDeliveryError; record: MoodStampRecord }
  | { status: 'skipped'; record: MoodStampRecord | null };

function optOutKey(email: string): string {
  return hashToken(`moodstamp-optout:${email.trim().toLowerCase()}`);
}

function recipientKey(email: string): string {
  return hashToken(`moodstamp-recipient:${email.trim().toLowerCase()}`);
}

export async function isOptedOut(email: string): Promise<boolean> {
  const rows = await query<{ email_hash: string }>('SELECT email_hash FROM moodstamp_optouts WHERE email_hash = $1', [
    optOutKey(email),
  ]);
  return rows.length > 0;
}

/**
 * Takes this address's one email for the day, if it is free.
 *
 * A single conditional upsert, so two MoodStamps arriving together cannot
 * both win it. Returns a release function for when the send then fails — the
 * day's email was not actually used — or null when the address has already
 * been emailed within the gap.
 */
async function claimEmailSlot(email: string, now: Date): Promise<(() => Promise<void>) | null> {
  const key = recipientKey(email);
  const before = await query<{ last_emailed_at: string }>(
    'SELECT last_emailed_at FROM moodstamp_recipients WHERE email_hash = $1',
    [key],
  );
  const cutoff = new Date(now.getTime() - EMAIL_GAP_HOURS * 3600 * 1000).toISOString();
  const claimed = await query<{ email_hash: string }>(
    `INSERT INTO moodstamp_recipients (email_hash, last_emailed_at) VALUES ($1, $2)
     ON CONFLICT (email_hash) DO UPDATE SET last_emailed_at = excluded.last_emailed_at
       WHERE moodstamp_recipients.last_emailed_at < $3
     RETURNING email_hash`,
    [key, now.toISOString(), cutoff],
  );
  if (claimed.length === 0) return null;

  const previous = before[0]?.last_emailed_at ?? null;
  return async () => {
    if (previous) {
      await execute('UPDATE moodstamp_recipients SET last_emailed_at = $1 WHERE email_hash = $2', [previous, key]);
    } else {
      await execute('DELETE FROM moodstamp_recipients WHERE email_hash = $1', [key]);
    }
  };
}

/** A private link to one stamp; the token exists only in the email it goes into. */
async function issueLink(stampId: string, now: Date): Promise<string> {
  const token = generateToken(24);
  await execute('INSERT INTO moodstamp_links (token_hash, moodstamp_id, created_at) VALUES ($1, $2, $3)', [
    hashToken(token),
    stampId,
    now.toISOString(),
  ]);
  return token;
}

const assetBaseUrl = () => absoluteUrl('/email');

/**
 * Delivers an email MoodStamp: by its own email if the address has not been
 * emailed today, or into their Skewvy inbox if it has.
 *
 * Only the sender can ask, only for a stamp that has not been delivered, and
 * only one attempt runs at a time — the stamp is claimed with a conditional
 * update first. An address that opted out gets nothing, in any form; one
 * sender cannot send the same address more than three a day.
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
    // The claim is released so the sender can try again at once.
    await execute('UPDATE moodstamps SET delivery_error = $1, delivery_attempted_at = NULL WHERE id = $2', [error, id]);
    return { status: 'failed', error, record: (await current())! };
  };

  // Without a provider the dev transport only pretends; in production that would be a lie.
  if (!recipient || (process.env.NODE_ENV === 'production' && !emailDeliveryConfigured())) {
    return stop('not_configured');
  }
  if (await isOptedOut(recipient)) return stop('opted_out');

  const pair = await consumeRateLimit(
    `moodstamp-to:${senderId}:${recipientKey(recipient)}`,
    RATE_RULES.moodStampToRecipient,
  );
  if (!pair.allowed) return stop('recipient_limit');

  const release = await claimEmailSlot(recipient, now);

  // Emailed within the day: into their inbox, and the reminder will cover it.
  if (!release) {
    await execute(
      `UPDATE moodstamps
          SET delivery_status = 'delivered', delivery_route = 'inbox', delivered_at = $1,
              recipient_notified_at = NULL, delivery_error = NULL
        WHERE id = $2`,
      [now.toISOString(), id],
    );
    return { status: 'delivered', record: (await current())! };
  }

  const record = (await current())!;
  const token = await issueLink(id, now);
  const openUrl = absoluteUrl(`/moodstamps/open/${token}`);
  const email = renderMoodStampEmail({
    data: { ...artworkFromRecord(record), date: now.toISOString(), state: 'unopened' },
    openUrl,
    optOutUrl: absoluteUrl(`/moodstamps/opt-out/${token}`),
    oneClickOptOutUrl: absoluteUrl(`/api/moodstamps/opt-out?token=${token}`),
    reportUrl: absoluteUrl(`/report?url=${encodeURIComponent(openUrl)}`),
    assetBaseUrl: assetBaseUrl(),
    siteUrl: SITE_URL,
  });

  try {
    const sent = await sendEmail({ to: recipient, ...email });
    const at = new Date().toISOString();
    await execute(
      `UPDATE moodstamps
          SET delivery_status = 'delivered', delivery_route = 'email', delivered_at = $1, recipient_notified_at = $1,
              provider_message_id = $2, delivery_error = NULL
        WHERE id = $3`,
      [at, sent.id, id],
    );
    return { status: 'delivered', record: (await current())! };
  } catch (error) {
    console.error('[moodstamps] email delivery failed', { id, error });
    await release();
    return stop('send_failed');
  }
}

async function hasVerifiedAccount(email: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    'SELECT id FROM users WHERE email_normalized = $1 AND email_verified_at IS NOT NULL',
    [email.trim().toLowerCase()],
  );
  return rows.length > 0;
}

/**
 * Sends the reminders that are due: one email per address with MoodStamps
 * waiting in its inbox that it has not been told about, once a day has passed
 * since that address was last emailed.
 *
 * Safe to run as often as anything likes — the day's email is claimed per
 * address, so a second run finds nothing to do — and bounded per run.
 */
export async function sendDueMoodStampReminders(limit = 25): Promise<{ sent: number; waiting: number }> {
  const due = await query<{ recipient_email: string; waiting: number | string; stamp_id: string }>(
    `SELECT recipient_email, COUNT(*) AS waiting, MIN(id) AS stamp_id
       FROM moodstamps
      WHERE channel = 'email' AND delivery_status = 'delivered' AND delivery_route = 'inbox'
        AND recipient_notified_at IS NULL AND recipient_email IS NOT NULL
      GROUP BY recipient_email
      LIMIT $1`,
    [limit],
  );

  let sent = 0;
  for (const row of due) {
    const email = row.recipient_email;
    const now = new Date();
    const markNotified = () =>
      execute(
        `UPDATE moodstamps SET recipient_notified_at = $1
          WHERE recipient_email = $2 AND delivery_route = 'inbox' AND recipient_notified_at IS NULL AND delivered_at <= $1`,
        [now.toISOString(), email],
      );

    // Opted out since: nothing more is sent, and nothing is left pending.
    if (await isOptedOut(email)) {
      await markNotified();
      continue;
    }
    if (process.env.NODE_ENV === 'production' && !emailDeliveryConfigured()) continue;

    const release = await claimEmailSlot(email, now);
    if (!release) continue;

    const hasAccount = await hasVerifiedAccount(email);
    const token = await issueLink(row.stamp_id, now);
    const reminder = renderReminderEmail({
      count: Number(row.waiting),
      hasAccount,
      email,
      actionUrl: hasAccount
        ? absoluteUrl('/moodstamps?view=received')
        : absoluteUrl(`/register?returnTo=${encodeURIComponent('/moodstamps?view=received')}`),
      optOutUrl: absoluteUrl(`/moodstamps/opt-out/${token}`),
      oneClickOptOutUrl: absoluteUrl(`/api/moodstamps/opt-out?token=${token}`),
      siteUrl: SITE_URL,
    });

    try {
      await sendEmail({ to: email, ...reminder });
      await markNotified();
      sent += 1;
    } catch (error) {
      console.error('[moodstamps] reminder failed', { error });
      await release();
    }
  }

  const linked = await sendDueLinkNotices(limit);
  return { sent: sent + linked.sent, waiting: due.length + linked.waiting };
}

/**
 * Tells people about MoodStamps that came in through their own link: one
 * email, under the same once-a-day rule as everything else sent to that
 * address, and only to a verified address whose owner has not switched it
 * off. A stamp they have already opened on Skewvy needs no email about it.
 */
async function sendDueLinkNotices(limit: number): Promise<{ sent: number; waiting: number }> {
  const due = await query<{ recipient_id: string; email: string; waiting: number | string }>(
    `SELECT s.recipient_id, u.email_normalized AS email, COUNT(*) AS waiting
       FROM moodstamp_link_stamps s
       JOIN users u ON u.id = s.recipient_id
       LEFT JOIN moodstamp_inbox_links l ON l.user_id = s.recipient_id
      WHERE s.recipient_notified_at IS NULL AND s.opened_at IS NULL
        AND u.email_verified_at IS NOT NULL AND u.suspended_at IS NULL
        AND COALESCE(l.notify, 1) = 1
      GROUP BY s.recipient_id, u.email_normalized
      LIMIT $1`,
    [limit],
  );

  let sent = 0;
  for (const row of due) {
    const now = new Date();
    const markNotified = () =>
      execute(
        `UPDATE moodstamp_link_stamps SET recipient_notified_at = $1
          WHERE recipient_id = $2 AND recipient_notified_at IS NULL AND created_at <= $1`,
        [now.toISOString(), row.recipient_id],
      );

    if (await isOptedOut(row.email)) {
      await markNotified();
      continue;
    }
    if (process.env.NODE_ENV === 'production' && !emailDeliveryConfigured()) continue;

    const release = await claimEmailSlot(row.email, now);
    if (!release) continue;

    const notice = renderReminderEmail({
      count: Number(row.waiting),
      hasAccount: true,
      email: row.email,
      actionUrl: absoluteUrl('/moodstamps?view=received'),
      optOutUrl: absoluteUrl('/moodstamps/receive'),
      siteUrl: SITE_URL,
      source: 'link',
    });

    try {
      await sendEmail({ to: row.email, ...notice });
      await markNotified();
      sent += 1;
    } catch (error) {
      console.error('[moodstamps] link notice failed', { error });
      await release();
    }
  }

  return { sent, waiting: due.length };
}

/**
 * Runs the reminder sweep after the current response has gone, so the person
 * sending a MoodStamp never waits for someone else's reminder. The daily cron
 * is the guarantee; this only makes reminders arrive nearer the hour they are
 * due whenever the site is in use. Outside a request there is nothing to hang
 * it on, and nothing is done.
 */
export function sweepRemindersSoon(): void {
  try {
    after(async () => {
      try {
        await sendDueMoodStampReminders(10);
      } catch (error) {
        console.error('[moodstamps] reminder sweep failed', { error });
      }
    });
  } catch {
    // Not inside a request (a script, a test): the cron will do it.
  }
}

async function stampForToken(token: string): Promise<MoodStampRow | null> {
  if (!token || token.length < 16 || token.length > 128) return null;
  const rows = await query<MoodStampRow>(
    `SELECT ${COLUMNS.split(',')
      .map((column) => (/^\d/.test(column.trim()) ? column.trim() : `m.${column.trim()}`))
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
  return { id: row.id, artwork: receivedArtwork(row), opened: row.opened_at !== null };
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
    [optOutKey(email), new Date().toISOString()],
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
