import { query, execute } from '@/lib/db';

export interface RateLimitRule {
  /** Requests allowed inside one window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window limiter backed by the database so limits hold across processes.
 * Deliberately coarse: it protects the write endpoints without adding latency
 * to the tapping loop, which is already batched client-side.
 */
export async function consumeRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (rule.windowSeconds * 1000)) * rule.windowSeconds * 1000).toISOString();

  const rows = await query<{ hit_count: number; window_start: string }>(
    `INSERT INTO rate_limits (bucket_key, hit_count, window_start)
     VALUES ($1, 1, $2)
     ON CONFLICT (bucket_key) DO UPDATE SET
       hit_count = CASE WHEN rate_limits.window_start = $2 THEN rate_limits.hit_count + 1 ELSE 1 END,
       window_start = $2
     RETURNING hit_count, window_start`,
    [key, windowStart],
  );

  const hits = rows[0]?.hit_count ?? 1;
  const windowEnds = new Date(windowStart).getTime() + rule.windowSeconds * 1000;

  return {
    allowed: hits <= rule.limit,
    remaining: Math.max(0, rule.limit - hits),
    retryAfterSeconds: Math.max(1, Math.ceil((windowEnds - now) / 1000)),
  };
}

/** Drops expired buckets. Cheap enough to call opportunistically. */
export async function pruneRateLimits(olderThanSeconds = 3600): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanSeconds * 1000).toISOString();
  await execute('DELETE FROM rate_limits WHERE window_start < $1', [cutoff]);
}

export const RATE_RULES = {
  register: { limit: 5, windowSeconds: 600 },
  login: { limit: 10, windowSeconds: 600 },
  loginPerAccount: { limit: 8, windowSeconds: 600 },
  pinResetRequest: { limit: 4, windowSeconds: 900 },
  pinReset: { limit: 8, windowSeconds: 900 },
  emailResend: { limit: 3, windowSeconds: 300 },
  /** Generous: one call covers a whole 400ms burst of taps. */
  reactionBatch: { limit: 240, windowSeconds: 60 },
  reactionQuantity: { limit: 6000, windowSeconds: 60 },
  adminWrite: { limit: 120, windowSeconds: 60 },
  /** Writing takes time; a person posting faster than this is not writing. */
  commentPost: { limit: 8, windowSeconds: 120 },
  commentVote: { limit: 90, windowSeconds: 60 },
  /** Enough to flag a genuinely bad thread; too few to bury one you disagree with. */
  commentReport: { limit: 10, windowSeconds: 3600 },
  /** The public report form, per IP. */
  siteReport: { limit: 5, windowSeconds: 3600 },
  /**
   * A change of mind is allowed; a flip every few seconds is somebody playing
   * with the head count, and each flip moves a public number.
   */
  opinionSwitch: { limit: 6, windowSeconds: 600 },
  /** A MoodStamp takes minutes to write; dozens an hour is not someone writing them. */
  moodStampCreate: { limit: 20, windowSeconds: 3600 },
  /**
   * How many MoodStamps one person can send one address in a day. Past this
   * it stops being feedback and starts being a campaign.
   */
  moodStampToRecipient: { limit: 3, windowSeconds: 86400 },
  /** The reminder sweep, when something outside Vercel's scheduler calls it. */
  moodStampSweep: { limit: 30, windowSeconds: 3600 },
  /** Retrying a failed send, or sending one that was waiting. */
  moodStampDeliver: { limit: 10, windowSeconds: 600 },
  /** Opening a stamp and stopping MoodStamps are public, keyed by IP. */
  moodStampPublic: { limit: 60, windowSeconds: 600 },
  /** Sending through someone's link, per IP or account: no account needed, so kept tight. */
  moodStampLinkSend: { limit: 6, windowSeconds: 3600 },
  /** One sender to one link in a day, as with an address: past this it is a campaign. */
  moodStampLinkPair: { limit: 3, windowSeconds: 86400 },
  /** Everything one link can take in a day, so a shared link cannot bury its owner. */
  moodStampLinkDaily: { limit: 60, windowSeconds: 86400 },
  /** The AI review at Preview, per account or network address. Each one is a paid model call. */
  moodStampReview: { limit: 40, windowSeconds: 3600 },
  /** Pausing, resuming, renewing a link. */
  moodStampLinkManage: { limit: 30, windowSeconds: 600 },
} satisfies Record<string, RateLimitRule>;
