import { randomBytes } from 'node:crypto';
import { execute, query } from '@/lib/db';
import type { PublicUser } from '@/lib/domain/types';
import type {
  MoodStampBoardData,
  MoodStampChannel,
  MoodStampDeliveryError,
  MoodStampDeliveryState,
  MoodStampReaction,
  MoodStampRecord,
  MoodStampSummary,
} from '@/lib/moodstamps/types';
import type { MoodStampDelivery, MoodStampDraft } from '@/lib/moodstamps/validation';
import { newId } from './crypto';

export interface MoodStampRow {
  id: string;
  receipt_code: string;
  sender_name: string;
  anonymous: number | boolean;
  recipient_name: string;
  reaction: MoodStampReaction;
  emotion: string;
  quantity: number;
  reason_what: string;
  reason_impact: string;
  reason_request: string;
  channel: MoodStampChannel;
  recipient_email: string | null;
  recipient_phone: string | null;
  delivery_status: MoodStampDeliveryState;
  delivery_error: MoodStampDeliveryError | null;
  opened_at: string | null;
  created_at: string;
}

export const COLUMNS = `id, receipt_code, sender_name, anonymous, recipient_name, reaction, emotion, quantity,
  reason_what, reason_impact, reason_request, channel, recipient_email, recipient_phone,
  delivery_status, delivery_error, opened_at, created_at`;

/** Seen by its sender: every stamp here is one they sent. */
export function toRecord(row: MoodStampRow): MoodStampRecord {
  return {
    id: row.id,
    direction: 'sent',
    emotion: row.emotion,
    reaction: row.reaction,
    quantity: Number(row.quantity),
    counterpartName: row.recipient_name,
    anonymous: Boolean(Number(row.anonymous)),
    occurredAt: row.created_at,
    opened: row.opened_at !== null,
    delivery: row.delivery_status,
    deliveryError: row.delivery_status === 'awaiting' ? row.delivery_error : null,
    artworkUrl: null,
    receiptCode: row.receipt_code,
    senderName: row.sender_name,
    recipientName: row.recipient_name,
    reasons: [row.reason_what, row.reason_impact, row.reason_request],
    channel: row.channel,
    destination: row.recipient_email ?? row.recipient_phone,
  };
}

function toSummary(record: MoodStampRecord): MoodStampSummary {
  return {
    id: record.id,
    direction: record.direction,
    emotion: record.emotion,
    reaction: record.reaction,
    quantity: record.quantity,
    counterpartName: record.counterpartName,
    anonymous: record.anonymous,
    occurredAt: record.occurredAt,
    opened: record.opened,
    delivery: record.delivery,
    deliveryError: record.deliveryError,
    artworkUrl: record.artworkUrl,
  };
}

/**
 * The receipt printed at the foot of a stamp: SKV-C4D8-045. Four random hex
 * characters and the count, so two stamps of the same size still differ.
 */
function receiptCodeFor(quantity: number): string {
  return `SKV-${randomBytes(2).toString('hex').toUpperCase()}-${String(quantity).padStart(3, '0')}`;
}

async function uniqueReceiptCode(quantity: number): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = receiptCodeFor(quantity);
    const taken = await query<{ id: string }>('SELECT id FROM moodstamps WHERE receipt_code = $1', [code]);
    if (taken.length === 0) return code;
  }
  // 65,536 codes per count; eight misses in a row means the space is crowded, so widen it.
  return `SKV-${randomBytes(4).toString('hex').toUpperCase()}-${String(quantity).padStart(3, '0')}`;
}

/**
 * Saves a MoodStamp its sender has finished.
 *
 * The draft and delivery have already passed the shared schema — language
 * checks included — in the route handler. Nothing is delivered here: email
 * and WhatsApp delivery are not switched on yet, so those stamps are stored
 * as awaiting delivery, and a downloaded one is recorded as handed over by
 * the sender.
 */
export async function createMoodStamp(input: {
  sender: PublicUser;
  draft: MoodStampDraft;
  delivery: MoodStampDelivery;
}): Promise<MoodStampRecord> {
  const { sender, draft, delivery } = input;
  const id = newId();
  const receiptCode = await uniqueReceiptCode(draft.quantity);
  const now = new Date().toISOString();

  await execute(
    `INSERT INTO moodstamps (id, receipt_code, sender_id, sender_name, anonymous, recipient_name, reaction, emotion,
       quantity, reason_what, reason_impact, reason_request, channel, recipient_email, recipient_phone,
       delivery_status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [
      id,
      receiptCode,
      sender.id,
      sender.displayName,
      draft.anonymous ? 1 : 0,
      draft.recipientName,
      draft.reaction,
      draft.emotion,
      draft.quantity,
      draft.reasonWhat,
      draft.reasonImpact,
      draft.reasonRequest,
      delivery.channel,
      delivery.channel === 'email' ? delivery.email : null,
      delivery.channel === 'whatsapp' ? delivery.phone : null,
      delivery.channel === 'download' ? 'downloaded' : 'awaiting',
      now,
    ],
  );

  const created = await getMoodStampForSender(id, sender.id);
  if (!created) throw new Error('The MoodStamp was saved but could not be read back.');
  return created;
}

/** One stamp, for its sender only. Anyone else gets nothing — not even that it exists. */
export async function getMoodStampForSender(id: string, userId: string): Promise<MoodStampRecord | null> {
  if (!id || !userId) return null;
  const rows = await query<MoodStampRow>(`SELECT ${COLUMNS} FROM moodstamps WHERE id = $1 AND sender_id = $2`, [
    id,
    userId,
  ]);
  return rows[0] ? toRecord(rows[0]) : null;
}

/**
 * The signed-in person's MoodStamp board: what they received and what they sent.
 *
 * Always keyed by the session's own user id — never by anything taken from a
 * URL or a request body — so one person's board can never be asked for by
 * another.
 *
 * Received stays empty for now. A stamp reaches its recipient by email or
 * WhatsApp, and until delivery is switched on nothing has reached anyone.
 */
export async function loadMoodStampBoard(userId: string): Promise<MoodStampBoardData> {
  if (!userId) throw new Error('A MoodStamp board belongs to a signed-in person.');

  const rows = await query<MoodStampRow>(
    `SELECT ${COLUMNS} FROM moodstamps WHERE sender_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [userId],
  );
  const total = await query<{ count: number | string }>('SELECT COUNT(*) AS count FROM moodstamps WHERE sender_id = $1', [
    userId,
  ]);

  return {
    received: [],
    sent: rows.map((row) => toSummary(toRecord(row))),
    counts: { received: 0, sent: Number(total[0]?.count ?? rows.length) },
  };
}
