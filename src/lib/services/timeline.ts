import { query, execute } from '@/lib/db';
import type { SqlExecutor } from '@/lib/db';
import { getTotals } from './totals';
import type { ArtifactType, ReactionType } from '@/lib/domain/types';

/**
 * The reaction history behind the trend chart.
 *
 * Reactions are rolled up into hourly buckets as they are recorded — one row
 * per artifact per hour, never one per tap, which keeps the same promise the
 * totals do. The chart then reads those buckets, chooses hourly or daily
 * resolution to suit the artifact's age, and turns them into a running total
 * that lands exactly on the numbers displayed beside it.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export type TrendResolution = 'hour' | 'day';

export interface TrendPoint {
  /** ISO timestamp for the start of the bucket. */
  at: string;
  /** Reactions received during this bucket. */
  eggs: number;
  medals: number;
  /** Lifetime totals as they stood at the end of this bucket. */
  cumulativeEggs: number;
  cumulativeMedals: number;
}

export interface ReactionTrend {
  resolution: TrendResolution;
  points: TrendPoint[];
  /** Lifetime totals at the moment the window opens. */
  openingEggs: number;
  openingMedals: number;
  /** Received inside the window, across every bucket. */
  windowEggs: number;
  windowMedals: number;
}

/** Truncates an instant to the top of its UTC hour. */
export function hourBucket(iso: string | number | Date): string {
  const date = new Date(iso);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

/**
 * Adds one batch to its hourly bucket. Called inside the same transaction that
 * moves the totals, so the history can never disagree with them.
 */
export async function recordTimelineBatch(
  tx: SqlExecutor,
  artifactType: ArtifactType,
  artifactId: string,
  reactionType: ReactionType,
  quantity: number,
  at: string,
): Promise<void> {
  const eggs = reactionType === 'rotten_egg' ? quantity : 0;
  const medals = reactionType === 'medal' ? quantity : 0;

  await tx.execute(
    `INSERT INTO reaction_timeline (artifact_type, artifact_id, bucket_start, rotten_egg_count, medal_count)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (artifact_type, artifact_id, bucket_start) DO UPDATE SET
       rotten_egg_count = reaction_timeline.rotten_egg_count + $4,
       medal_count = reaction_timeline.medal_count + $5`,
    [artifactType, artifactId, hourBucket(at), eggs, medals],
  );
}

/**
 * Reads the trend for one artifact.
 *
 * The window is chosen from the data rather than fixed: an artifact whose
 * history is under two days is drawn hour by hour, anything older day by day.
 * Buckets with no activity are filled in as flat, so a quiet stretch reads as
 * quiet rather than as a missing segment.
 *
 * The running total starts from whatever the artifact had accumulated before
 * the window opened, so the last point equals the lifetime total on the page.
 */
export async function reactionTrend(
  artifactType: ArtifactType,
  artifactId: string,
  options: { maxPoints?: number } = {},
): Promise<ReactionTrend> {
  const maxPoints = options.maxPoints ?? 32;

  const [rows, totals] = await Promise.all([
    query<{ bucket_start: string; rotten_egg_count: number; medal_count: number }>(
      `SELECT bucket_start, rotten_egg_count, medal_count FROM reaction_timeline
        WHERE artifact_type = $1 AND artifact_id = $2
        ORDER BY bucket_start`,
      [artifactType, artifactId],
    ),
    getTotals(artifactType, artifactId),
  ]);

  if (rows.length === 0) {
    return {
      resolution: 'day',
      points: [],
      openingEggs: totals.rottenEggTotal,
      openingMedals: totals.medalTotal,
      windowEggs: 0,
      windowMedals: 0,
    };
  }

  const firstAt = new Date(rows[0].bucket_start).getTime();
  const lastAt = Math.max(new Date(rows[rows.length - 1].bucket_start).getTime(), Date.now() - HOUR_MS);
  const resolution: TrendResolution = lastAt - firstAt <= 2 * DAY_MS ? 'hour' : 'day';
  const step = resolution === 'hour' ? HOUR_MS : DAY_MS;

  // Keep the chart readable: never more buckets than the axis can carry, and
  // when there are more, show the most recent ones.
  const alignedLast = Math.floor(lastAt / step) * step;
  const alignedFirst = Math.max(
    Math.floor(firstAt / step) * step,
    alignedLast - (maxPoints - 1) * step,
  );

  const buckets = new Map<number, { eggs: number; medals: number }>();
  let beforeWindowEggs = 0;
  let beforeWindowMedals = 0;

  for (const row of rows) {
    const eggs = Number(row.rotten_egg_count);
    const medals = Number(row.medal_count);
    const at = Math.floor(new Date(row.bucket_start).getTime() / step) * step;

    if (at < alignedFirst) {
      beforeWindowEggs += eggs;
      beforeWindowMedals += medals;
      continue;
    }

    const existing = buckets.get(at) ?? { eggs: 0, medals: 0 };
    existing.eggs += eggs;
    existing.medals += medals;
    buckets.set(at, existing);
  }

  let windowEggs = 0;
  let windowMedals = 0;
  for (const bucket of buckets.values()) {
    windowEggs += bucket.eggs;
    windowMedals += bucket.medals;
  }

  /*
   * Everything the artifact holds that the recorded history does not account
   * for — reactions from before this rollup existed — sits in the opening
   * figure. Without it the line would end below the total printed beside it.
   */
  const recordedEggs = beforeWindowEggs + windowEggs;
  const recordedMedals = beforeWindowMedals + windowMedals;
  let cumulativeEggs = Math.max(0, totals.rottenEggTotal - recordedEggs) + beforeWindowEggs;
  let cumulativeMedals = Math.max(0, totals.medalTotal - recordedMedals) + beforeWindowMedals;

  const openingEggs = cumulativeEggs;
  const openingMedals = cumulativeMedals;

  const points: TrendPoint[] = [];
  for (let at = alignedFirst; at <= alignedLast; at += step) {
    const bucket = buckets.get(at) ?? { eggs: 0, medals: 0 };
    cumulativeEggs += bucket.eggs;
    cumulativeMedals += bucket.medals;
    points.push({
      at: new Date(at).toISOString(),
      eggs: bucket.eggs,
      medals: bucket.medals,
      cumulativeEggs,
      cumulativeMedals,
    });
  }

  return { resolution, points, openingEggs, openingMedals, windowEggs, windowMedals };
}

/**
 * Derives history for artifacts that have none.
 *
 * Reaction aggregates carry the moment each person first reacted, which is
 * enough to place their contribution on a timeline. It is an approximation —
 * everything a person sent is dated to when they arrived — and it is only ever
 * applied to artifacts with no recorded buckets at all, so live data is never
 * overwritten by it.
 */
export async function backfillReactionTimeline(): Promise<number> {
  const covered = new Set(
    (
      await query<{ artifact_type: string; artifact_id: string }>(
        'SELECT DISTINCT artifact_type, artifact_id FROM reaction_timeline',
      )
    ).map((row) => `${row.artifact_type}:${row.artifact_id}`),
  );

  const rows = await query<{
    artifact_type: string;
    artifact_id: string;
    created_at: string;
    rotten_egg_count: number;
    medal_count: number;
  }>(
    `SELECT artifact_type, artifact_id, created_at, rotten_egg_count, medal_count
       FROM reaction_aggregates`,
  );

  const buckets = new Map<string, { type: string; id: string; at: string; eggs: number; medals: number }>();

  for (const row of rows) {
    const key = `${row.artifact_type}:${row.artifact_id}`;
    if (covered.has(key)) continue;

    const at = hourBucket(row.created_at);
    const bucketKey = `${key}:${at}`;
    const existing = buckets.get(bucketKey) ?? { type: row.artifact_type, id: row.artifact_id, at, eggs: 0, medals: 0 };
    existing.eggs += Number(row.rotten_egg_count);
    existing.medals += Number(row.medal_count);
    buckets.set(bucketKey, existing);
  }

  for (const bucket of buckets.values()) {
    await execute(
      `INSERT INTO reaction_timeline (artifact_type, artifact_id, bucket_start, rotten_egg_count, medal_count)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (artifact_type, artifact_id, bucket_start) DO NOTHING`,
      [bucket.type, bucket.id, bucket.at, bucket.eggs, bucket.medals],
    );
  }

  return buckets.size;
}
