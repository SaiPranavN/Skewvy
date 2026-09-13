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
} satisfies Record<string, RateLimitRule>;
