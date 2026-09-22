import { query, execute } from '@/lib/db';
import type { SqlExecutor } from '@/lib/db';
import { getTotals } from './totals';
import type { ArtifactType, ReactionType, Stance } from '@/lib/domain/types';

/**
 * The history behind the two trend charts.
 *
 * Both are rolled up into hourly buckets as they are recorded — one row per
 * artifact per hour, never one per tap, which keeps the same promise the totals
 * do. They are read separately and drawn separately, because they measure
 * different things: the reaction timeline counts taps, which one person can add
 * to without limit, and the opinion timeline counts people, who are counted
 * exactly once and never again.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export type TrendResolution = 'hour' | 'day';

/**
 * One bucket of either history.
 *
 * The two series are named for the side they belong to rather than for what is
 * being counted, so one chart component can draw a reaction trend (Rotten Eggs
 * against Medals) and an opinion trend (critical people against appreciative
 * people) without knowing which it has. What the numbers *mean* is carried by
 * the `measures` field on the trend itself, and the chart is required to label
 * it — the two must never be read as interchangeable.
 */
export interface TrendPoint {
  /** ISO timestamp for the start of the bucket. */
  at: string;
  /** Counted during this bucket alone. */
  negative: number;
  positive: number;
  /** Running totals as they stood at the end of this bucket. */
  cumulativeNegative: number;
  cumulativePositive: number;
}

export interface Trend {
  /** What a point counts: unbounded taps, or people counted once each. */
  measures: 'reactions' | 'people';
  resolution: TrendResolution;
  points: TrendPoint[];
  /** Running totals at the moment the window opens. */
  openingNegative: number;
  openingPositive: number;
  /** Counted inside the window, across every bucket. */
  windowNegative: number;
  windowPositive: number;
}

/** Both histories for one artifact, read together but never merged. */
export interface ArtifactTrends {
  reactions: Trend;
  opinions: Trend;
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
 * Marks the hour in which one person took a side.
 *
 * Called from inside the reaction transaction, and only on the batch that
 * commits the opinion — a person appears in exactly one bucket, for good. That
 * is what lets the opinion chart be read as a head count rising over time
 * rather than as a second, quieter picture of tapping.
 */
export async function recordOpinionCommitment(
  tx: SqlExecutor,
  artifactType: ArtifactType,
  artifactId: string,
  stance: Stance,
  at: string,
): Promise<void> {
  const positive = stance === 'positive' ? 1 : 0;
  const negative = stance === 'negative' ? 1 : 0;

  await tx.execute(
    `INSERT INTO opinion_timeline (artifact_type, artifact_id, bucket_start, positive_count, negative_count)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (artifact_type, artifact_id, bucket_start) DO UPDATE SET
       positive_count = opinion_timeline.positive_count + $4,
       negative_count = opinion_timeline.negative_count + $5`,
    [artifactType, artifactId, hourBucket(at), positive, negative],
  );
}

/**
 * Reads one artifact's reaction history — Rotten Eggs against Medals, in taps.
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
): Promise<Trend> {
  const [rows, totals] = await Promise.all([
    query<{ bucket_start: string; rotten_egg_count: number; medal_count: number }>(
      `SELECT bucket_start, rotten_egg_count, medal_count FROM reaction_timeline
        WHERE artifact_type = $1 AND artifact_id = $2
        ORDER BY bucket_start`,
      [artifactType, artifactId],
    ),
    getTotals(artifactType, artifactId),
  ]);

  return assemble({
    measures: 'reactions',
    maxPoints: options.maxPoints ?? 32,
    lifetimeNegative: totals.rottenEggTotal,
    lifetimePositive: totals.medalTotal,
    rows: rows.map((row) => ({
      at: row.bucket_start,
      negative: Number(row.rotten_egg_count),
      positive: Number(row.medal_count),
    })),
  });
}

/**
 * Reads one artifact's opinion history — critical people against appreciative
 * people, each counted once on the hour they took a side.
 *
 * Shares the shaping logic with the reaction trend but nothing else: the two
 * are separate reads of separate tables, and are never plotted together.
 */
export async function opinionTrend(
  artifactType: ArtifactType,
  artifactId: string,
  options: { maxPoints?: number } = {},
): Promise<Trend> {
  const [rows, totals] = await Promise.all([
    query<{ bucket_start: string; positive_count: number; negative_count: number }>(
      `SELECT bucket_start, positive_count, negative_count FROM opinion_timeline
        WHERE artifact_type = $1 AND artifact_id = $2
        ORDER BY bucket_start`,
      [artifactType, artifactId],
    ),
    getTotals(artifactType, artifactId),
  ]);

  return assemble({
    measures: 'people',
    maxPoints: options.maxPoints ?? 32,
    lifetimeNegative: totals.negativeOpinionTotal,
    lifetimePositive: totals.positiveOpinionTotal,
    rows: rows.map((row) => ({
      at: row.bucket_start,
      negative: Number(row.negative_count),
      positive: Number(row.positive_count),
    })),
  });
}

/** Both histories for one artifact, fetched in parallel and kept apart. */
export async function artifactTrends(
  artifactType: ArtifactType,
  artifactId: string,
  options: { maxPoints?: number } = {},
): Promise<ArtifactTrends> {
  const [reactions, opinions] = await Promise.all([
    reactionTrend(artifactType, artifactId, options),
    opinionTrend(artifactType, artifactId, options),
  ]);
  return { reactions, opinions };
}

interface RawBucket {
  at: string;
  negative: number;
  positive: number;
}

/**
 * Turns raw hourly buckets into a drawable running series.
 *
 * Identical arithmetic for both histories, which is the point: whatever the
 * chart shows, the last plotted value is the lifetime figure printed beside it.
 */
function assemble(input: {
  measures: Trend['measures'];
  maxPoints: number;
  lifetimeNegative: number;
  lifetimePositive: number;
  rows: RawBucket[];
}): Trend {
  const { measures, maxPoints, lifetimeNegative, lifetimePositive, rows } = input;

  if (rows.length === 0) {
    return {
      measures,
      resolution: 'day',
      points: [],
      openingNegative: lifetimeNegative,
      openingPositive: lifetimePositive,
      windowNegative: 0,
      windowPositive: 0,
    };
  }

  const firstAt = new Date(rows[0].at).getTime();
  const lastAt = Math.max(new Date(rows[rows.length - 1].at).getTime(), Date.now() - HOUR_MS);
  const resolution: TrendResolution = lastAt - firstAt <= 2 * DAY_MS ? 'hour' : 'day';
  const step = resolution === 'hour' ? HOUR_MS : DAY_MS;

  // Keep the chart readable: never more buckets than the axis can carry, and
  // when there are more, show the most recent ones.
  const alignedLast = Math.floor(lastAt / step) * step;
  const alignedFirst = Math.max(
    Math.floor(firstAt / step) * step,
    alignedLast - (maxPoints - 1) * step,
  );

  const buckets = new Map<number, { negative: number; positive: number }>();
  let beforeWindowNegative = 0;
  let beforeWindowPositive = 0;

  for (const row of rows) {
    const at = Math.floor(new Date(row.at).getTime() / step) * step;

    if (at < alignedFirst) {
      beforeWindowNegative += row.negative;
      beforeWindowPositive += row.positive;
      continue;
    }

    const existing = buckets.get(at) ?? { negative: 0, positive: 0 };
    existing.negative += row.negative;
    existing.positive += row.positive;
    buckets.set(at, existing);
  }

  let windowNegative = 0;
  let windowPositive = 0;
  for (const bucket of buckets.values()) {
    windowNegative += bucket.negative;
    windowPositive += bucket.positive;
  }

  /*
   * Everything the artifact holds that the recorded history does not account
   * for — activity from before this rollup existed — sits in the opening
   * figure. Without it the line would end below the total printed beside it.
   */
  const recordedNegative = beforeWindowNegative + windowNegative;
  const recordedPositive = beforeWindowPositive + windowPositive;
  let cumulativeNegative = Math.max(0, lifetimeNegative - recordedNegative) + beforeWindowNegative;
  let cumulativePositive = Math.max(0, lifetimePositive - recordedPositive) + beforeWindowPositive;

  const openingNegative = cumulativeNegative;
  const openingPositive = cumulativePositive;

  const points: TrendPoint[] = [];
  for (let at = alignedFirst; at <= alignedLast; at += step) {
    const bucket = buckets.get(at) ?? { negative: 0, positive: 0 };
    cumulativeNegative += bucket.negative;
    cumulativePositive += bucket.positive;
    points.push({
      at: new Date(at).toISOString(),
      negative: bucket.negative,
      positive: bucket.positive,
      cumulativeNegative,
      cumulativePositive,
    });
  }

  return {
    measures,
    resolution,
    points,
    openingNegative,
    openingPositive,
    windowNegative,
    windowPositive,
  };
}

/**
 * Rebuilds one artifact's history from the aggregates that remain.
 *
 * Needed after an account is deleted: the cascade takes their reactions but a
 * rollup cannot un-count what it already summed, so the chart would keep
 * reporting contributions that no longer exist. Derived the same way as the
 * backfill, which means hourly detail collapses to when each person first
 * reacted — a fair trade for numbers that agree with the totals.
 */
export async function rebuildTimelineFor(artifactType: ArtifactType, artifactId: string): Promise<void> {
  await execute('DELETE FROM reaction_timeline WHERE artifact_type = $1 AND artifact_id = $2', [
    artifactType,
    artifactId,
  ]);

  const rows = await query<{ created_at: string; rotten_egg_count: number; medal_count: number }>(
    'SELECT created_at, rotten_egg_count, medal_count FROM reaction_aggregates WHERE artifact_type = $1 AND artifact_id = $2',
    [artifactType, artifactId],
  );

  const buckets = new Map<string, { eggs: number; medals: number }>();
  for (const row of rows) {
    const at = hourBucket(row.created_at);
    const bucket = buckets.get(at) ?? { eggs: 0, medals: 0 };
    bucket.eggs += Number(row.rotten_egg_count);
    bucket.medals += Number(row.medal_count);
    buckets.set(at, bucket);
  }

  for (const [at, bucket] of buckets) {
    await execute(
      `INSERT INTO reaction_timeline (artifact_type, artifact_id, bucket_start, rotten_egg_count, medal_count)
       VALUES ($1, $2, $3, $4, $5)`,
      [artifactType, artifactId, at, bucket.eggs, bucket.medals],
    );
  }

  await rebuildOpinionTimelineFor(artifactType, artifactId);
}

/**
 * Rebuilds one artifact's opinion history from the opinion rows.
 *
 * Exact rather than approximate, unlike its reaction counterpart: an opinion
 * row carries the moment the side was taken, which is precisely the moment the
 * bucket is meant to record.
 */
export async function rebuildOpinionTimelineFor(artifactType: ArtifactType, artifactId: string): Promise<void> {
  await execute('DELETE FROM opinion_timeline WHERE artifact_type = $1 AND artifact_id = $2', [
    artifactType,
    artifactId,
  ]);

  const rows = await query<{ created_at: string; stance: string }>(
    'SELECT created_at, stance FROM opinions WHERE artifact_type = $1 AND artifact_id = $2',
    [artifactType, artifactId],
  );

  const buckets = new Map<string, { positive: number; negative: number }>();
  for (const row of rows) {
    const at = hourBucket(row.created_at);
    const bucket = buckets.get(at) ?? { positive: 0, negative: 0 };
    if (row.stance === 'positive') bucket.positive += 1;
    else bucket.negative += 1;
    buckets.set(at, bucket);
  }

  for (const [at, bucket] of buckets) {
    await execute(
      `INSERT INTO opinion_timeline (artifact_type, artifact_id, bucket_start, positive_count, negative_count)
       VALUES ($1, $2, $3, $4, $5)`,
      [artifactType, artifactId, at, bucket.positive, bucket.negative],
    );
  }
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

/**
 * Derives opinion history for artifacts that have none.
 *
 * Every opinion ever recorded carries its own timestamp, so this loses nothing:
 * artifacts whose sides were taken before the rollup existed get an exact
 * history rather than an approximation. Artifacts that already have buckets are
 * left alone, so live data is never overwritten.
 */
export async function backfillOpinionTimeline(): Promise<number> {
  const covered = new Set(
    (
      await query<{ artifact_type: string; artifact_id: string }>(
        'SELECT DISTINCT artifact_type, artifact_id FROM opinion_timeline',
      )
    ).map((row) => `${row.artifact_type}:${row.artifact_id}`),
  );

  const rows = await query<{
    artifact_type: string;
    artifact_id: string;
    created_at: string;
    stance: string;
  }>('SELECT artifact_type, artifact_id, created_at, stance FROM opinions');

  const buckets = new Map<
    string,
    { type: string; id: string; at: string; positive: number; negative: number }
  >();

  for (const row of rows) {
    const key = `${row.artifact_type}:${row.artifact_id}`;
    if (covered.has(key)) continue;

    const at = hourBucket(row.created_at);
    const bucketKey = `${key}:${at}`;
    const existing =
      buckets.get(bucketKey) ??
      { type: row.artifact_type, id: row.artifact_id, at, positive: 0, negative: 0 };
    if (row.stance === 'positive') existing.positive += 1;
    else existing.negative += 1;
    buckets.set(bucketKey, existing);
  }

  for (const bucket of buckets.values()) {
    await execute(
      `INSERT INTO opinion_timeline (artifact_type, artifact_id, bucket_start, positive_count, negative_count)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (artifact_type, artifact_id, bucket_start) DO NOTHING`,
      [bucket.type, bucket.id, bucket.at, bucket.positive, bucket.negative],
    );
  }

  return buckets.size;
}
