import { randomInt } from 'node:crypto';
import { execute, query } from '@/lib/db';
import type { PublicUser } from '@/lib/domain/types';
import type { InboxLink, MoodStampRecord } from '@/lib/moodstamps/types';
import type { MoodStampDraft } from '@/lib/moodstamps/validation';
import { absoluteUrl } from '@/lib/site';
import { newId } from './crypto';
import { LINK_COLUMNS, toRecord, uniqueReceiptCode, type MoodStampRow } from './moodstamps';

/**
 * A person's MoodStamp link: skewvy.com/to/<code>, which they share wherever
 * they like, and on which anyone can write them a MoodStamp — with an account
 * or without one.
 *
 * What arrives goes straight onto the owner's Received board. The owner can
 * pause the link, turn off the email about new arrivals, or replace it with a
 * new one, which stops the old address working at once.
 */

/** No 0/o, 1/l/i: a code read aloud or copied by hand survives the trip. */
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_LENGTH = 8;
export const LINK_CODE_PATTERN = /^[a-hjkmnp-z2-9]{8}$/;

function newCode(): string {
  let code = '';
  for (let index = 0; index < CODE_LENGTH; index += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export type { InboxLink };

interface InboxLinkRow {
  code: string;
  paused: number | boolean;
  notify: number | boolean;
  created_at: string;
}

async function toInboxLink(userId: string, row: InboxLinkRow): Promise<InboxLink> {
  const count = await query<{ count: number | string }>(
    'SELECT COUNT(*) AS count FROM moodstamp_link_stamps WHERE recipient_id = $1',
    [userId],
  );
  return {
    code: row.code,
    url: linkUrl(row.code),
    paused: Boolean(Number(row.paused)),
    notify: Boolean(Number(row.notify)),
    createdAt: row.created_at,
    received: Number(count[0]?.count ?? 0),
  };
}

export function linkUrl(code: string): string {
  return absoluteUrl(`/to/${code}`);
}

async function readLink(userId: string): Promise<InboxLinkRow | null> {
  const rows = await query<InboxLinkRow>(
    'SELECT code, paused, notify, created_at FROM moodstamp_inbox_links WHERE user_id = $1',
    [userId],
  );
  return rows[0] ?? null;
}

/**
 * The person's link, made the first time they ask for it. Asking again
 * returns the same one; two first requests at once still make only one.
 */
export async function ensureInboxLink(userId: string): Promise<InboxLink> {
  const existing = await readLink(userId);
  if (existing) return toInboxLink(userId, existing);

  const now = new Date().toISOString();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await execute(
        `INSERT INTO moodstamp_inbox_links (user_id, code, paused, notify, created_at)
         VALUES ($1, $2, 0, 1, $3) ON CONFLICT (user_id) DO NOTHING`,
        [userId, newCode(), now],
      );
      break;
    } catch {
      // The code was taken by someone else: draw another.
    }
  }
  const created = await readLink(userId);
  if (!created) throw new Error('The MoodStamp link could not be created.');
  return toInboxLink(userId, created);
}

/** The link as its owner sees it, or null if they have never made one. */
export async function getInboxLink(userId: string): Promise<InboxLink | null> {
  const row = await readLink(userId);
  return row ? toInboxLink(userId, row) : null;
}

/**
 * Pauses or resumes the link, switches the arrival email, or replaces the
 * code. Only the owner's own row can be touched: the id comes from the session.
 */
export async function updateInboxLink(
  userId: string,
  change: { paused?: boolean; notify?: boolean; renew?: boolean },
): Promise<InboxLink | null> {
  if (!(await readLink(userId))) return null;

  if (change.paused !== undefined) {
    await execute('UPDATE moodstamp_inbox_links SET paused = $1 WHERE user_id = $2', [change.paused ? 1 : 0, userId]);
  }
  if (change.notify !== undefined) {
    await execute('UPDATE moodstamp_inbox_links SET notify = $1 WHERE user_id = $2', [change.notify ? 1 : 0, userId]);
  }
  if (change.renew) {
    const now = new Date().toISOString();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await execute('UPDATE moodstamp_inbox_links SET code = $1, rotated_at = $2 WHERE user_id = $3', [
          newCode(),
          now,
          userId,
        ]);
        break;
      } catch {
        // Collided with another code: draw again.
      }
    }
  }
  return getInboxLink(userId);
}

/** What the public page of a link knows: whose it is, and whether it is open. */
export interface PublicInboxLink {
  ownerId: string;
  ownerName: string;
  paused: boolean;
}

/**
 * Resolves a code from a URL. A code that was replaced, never existed, or
 * belongs to a suspended account resolves to nothing, all alike.
 */
export async function resolveInboxLink(code: string): Promise<PublicInboxLink | null> {
  const normalised = code.trim().toLowerCase();
  if (!LINK_CODE_PATTERN.test(normalised)) return null;
  const rows = await query<{ user_id: string; display_name: string; paused: number | boolean }>(
    `SELECT l.user_id, u.display_name, l.paused
       FROM moodstamp_inbox_links l
       JOIN users u ON u.id = l.user_id
      WHERE l.code = $1 AND u.suspended_at IS NULL`,
    [normalised],
  );
  const row = rows[0];
  return row ? { ownerId: row.user_id, ownerName: row.display_name, paused: Boolean(Number(row.paused)) } : null;
}

/**
 * Who is writing. Someone signed in signs with their account, verified, or
 * anonymously; anyone else types a name — printed as the name they gave, never
 * as verified — or stays anonymous.
 */
export type LinkSender = { kind: 'account'; user: PublicUser } | { kind: 'guest'; name: string | null };

/**
 * Writes a MoodStamp onto the owner's board. The draft has been checked in
 * full by the route, language included; the name it is addressed to is the
 * owner's own, whatever the draft said.
 */
export async function createLinkMoodStamp(input: {
  link: PublicInboxLink;
  draft: MoodStampDraft;
  sender: LinkSender;
}): Promise<MoodStampRecord> {
  const { link, draft, sender } = input;
  const id = newId();
  const receiptCode = await uniqueReceiptCode(draft.quantity);
  const anonymous = draft.anonymous || (sender.kind === 'guest' && !sender.name);
  const senderName = sender.kind === 'account' ? sender.user.displayName : (sender.name ?? 'Anonymous');

  await execute(
    `INSERT INTO moodstamp_link_stamps (id, receipt_code, recipient_id, sender_id, sender_name, anonymous, recipient_name,
       reaction, emotion, quantity, reason_what, reason_impact, reason_request, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      id,
      receiptCode,
      link.ownerId,
      sender.kind === 'account' ? sender.user.id : null,
      senderName,
      anonymous ? 1 : 0,
      link.ownerName,
      draft.reaction,
      draft.emotion,
      draft.quantity,
      draft.reasonWhat,
      draft.reasonImpact,
      draft.reasonRequest,
      new Date().toISOString(),
    ],
  );

  const rows = await query<MoodStampRow>(`SELECT ${LINK_COLUMNS} FROM moodstamp_link_stamps WHERE id = $1`, [id]);
  if (!rows[0]) throw new Error('The MoodStamp was saved but could not be read back.');
  // The sender's copy: whoever they are, they see what they wrote, and where it went.
  return { ...toRecord(rows[0]), destination: null };
}
