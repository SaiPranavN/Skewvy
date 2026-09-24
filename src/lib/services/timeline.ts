import { query, queryOne, execute } from '@/lib/db';
import type { SqlExecutor } from '@/lib/db';
import { getTotals } from './totals';
import type { ArtifactType, ReactionType, Stance } from '@/lib/domain/types';
import {
  RANGE_SPEC,
  bucketStart,
  defaultRange,
  nextBucket,
  previousBucket,
  type TrendRange,
  type TrendStep,
} from '@/lib/domain/trend-ranges';

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

const DAY_MS = 86_400_000;

export type TrendResolution = TrendStep;

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
  /** The window this was read over. */
  range: TrendRange;
  /** The bucket size that window is drawn at. */
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
  /** Shared by both, so the two charts always cover the same stretch of time. */
  range: TrendRange;
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
 * Moves one person from one side to the other in the opinion history.
 *
 * A pair of opposite deltas in the hour it happened, so the running totals
 * drop on one line and rise on the other at the moment of the change, and
 * every earlier point keeps saying what was true at the time.
 */
export async function recordOpinionSwitch(
  tx: SqlExecutor,
  artifactType: ArtifactType,
  artifactId: string,
  to: Stance,
  at: string,
): Promise<void> {
  const positive = to === 'positive' ? 1 : -1;
  const negative = -positive;

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
 * The two timelines, described once so the readers below share every line of
 * logic and differ only in which table and which columns they read.
 */
const SOURCES = {
  reactions: {
    table: 'reaction_timeline',
    negative: 'rotten_egg_count',
    positive: 'medal_count',
  },
  people: {
    table: 'opinion_timeline',
    negative: 'negative_count',
    positive: 'positive_count',
  },
} as const;

interface RawBucket {
  at: number;
  negative: number;
  positive: number;
}

/**
 * Reads one timeline's buckets over a window, at the grain the window wants.
 *
 * Anything coarser than an hour is summed by day in SQL first — `substr` on
 * the ISO text is the one date truncation SQLite and PostgreSQL agree on — so
 * five years of an active artifact arrives as at most ~1,800 day rows rather
 * than ~44,000 hourly ones. Days are then folded into weeks or months here.
 */
async function readWindow(
  measures: Trend['measures'],
  artifactType: ArtifactType,
  artifactId: string,
  since: number,
  step: TrendStep,
): Promise<RawBucket[]> {
  const source = SOURCES[measures];
  const sinceIso = new Date(since).toISOString();

  if (step === 'hour') {
    const rows = await query<{ bucket_start: string; negative: number; positive: number }>(
      `SELECT bucket_start, ${source.negative} AS negative, ${source.positive} AS positive
         FROM ${source.table}
        WHERE artifact_type = $1 AND artifact_id = $2 AND bucket_start >= $3`,
      [artifactType, artifactId, sinceIso],
    );
    return rows.map((row) => ({
      at: bucketStart(new Date(row.bucket_start).getTime(), step),
      negative: Number(row.negative),
      positive: Number(row.positive),
    }));
  }

  const rows = await query<{ day: string; negative: number | null; positive: number | null }>(
    `SELECT substr(bucket_start, 1, 10) AS day,
            SUM(${source.negative}) AS negative,
            SUM(${source.positive}) AS positive
       FROM ${source.table}
      WHERE artifact_type = $1 AND artifact_id = $2 AND bucket_start >= $3
      GROUP BY substr(bucket_start, 1, 10)`,
    [artifactType, artifactId, sinceIso],
  );
  return rows.map((row) => ({
    at: bucketStart(new Date(`${row.day}T00:00:00.000Z`).getTime(), step),
    negative: Number(row.negative ?? 0),
    positive: Number(row.positive ?? 0),
  }));
}

/** When a timeline first recorded anything for this artifact, if ever. */
async function firstActivity(
  measures: Trend['measures'],
  artifactType: ArtifactType,
  artifactId: string,
): Promise<number | null> {
  const source = SOURCES[measures];
  const row = await queryOne<{ first: string | null }>(
    `SELECT MIN(bucket_start) AS first FROM ${source.table} WHERE artifact_type = $1 AND artifact_id = $2`,
    [artifactType, artifactId],
  );
  return row?.first ? new Date(row.first).getTime() : null;
}

/**
 * Reads one history over one range.
 *
 * The chart starts at whichever is later: the start of the range, or one
 * bucket before this artifact's first recorded activity. A three-day-old story
 * on "5Y" therefore shows its three days rather than five years of empty axis,
 * and the extra bucket in front gives even a single day of history a starting
 * point to rise from.
 *
 * Buckets with no activity are filled in as flat, so a quiet stretch reads as
 * quiet rather than as a missing segment. The running total opens at the
 * lifetime figure minus everything inside the window — which folds in activity
 * from before the rollup existed as well — so the last point always equals the
 * lifetime total printed beside the chart.
 */
async function readTrend(
  measures: Trend['measures'],
  artifactType: ArtifactType,
  artifactId: string,
  range: TrendRange,
  lifetime: { negative: number; positive: number },
  now = Date.now(),
): Promise<Trend> {
  const step = RANGE_SPEC[range].step;
  const rangeStart = bucketStart(now - RANGE_SPEC[range].days * DAY_MS, step);
  const lastBucket = bucketStart(now, step);

  const first = await firstActivity(measures, artifactType, artifactId);

  if (first === null) {
    return {
      measures,
      range,
      resolution: step,
      points: [],
      openingNegative: lifetime.negative,
      openingPositive: lifetime.positive,
      windowNegative: 0,
      windowPositive: 0,
    };
  }

  const windowStart = Math.max(rangeStart, previousBucket(bucketStart(first, step), step));
  const rows = await readWindow(measures, artifactType, artifactId, windowStart, step);

  const buckets = new Map<number, { negative: number; positive: number }>();
  for (const row of rows) {
    if (row.at < windowStart) continue;
    const existing = buckets.get(row.at) ?? { negative: 0, positive: 0 };
    existing.negative += row.negative;
    existing.positive += row.positive;
    buckets.set(row.at, existing);
  }

  let windowNegative = 0;
  let windowPositive = 0;
  for (const bucket of buckets.values()) {
    windowNegative += bucket.negative;
    windowPositive += bucket.positive;
  }

  let cumulativeNegative = Math.max(0, lifetime.negative - windowNegative);
  let cumulativePositive = Math.max(0, lifetime.positive - windowPositive);
  const openingNegative = cumulativeNegative;
  const openingPositive = cumulativePositive;

  const points: TrendPoint[] = [];
  for (let at = windowStart; at <= lastBucket; at = nextBucket(at, step)) {
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
    range,
    resolution: step,
    points,
    openingNegative,
    openingPositive,
    windowNegative,
    windowPositive,
  };
}

/**
 * The range an artifact's charts open on when none is asked for: the smallest
 * that holds its whole history. Read from the reaction timeline, which always
 * starts no later than the opinion one — a side is taken by reacting.
 */
export async function defaultTrendRange(artifactType: ArtifactType, artifactId: string): Promise<TrendRange> {
  return defaultRange(await firstActivity('reactions', artifactType, artifactId));
}

/** Rotten Eggs against Medals, in taps, over one range. */
export async function reactionTrend(
  artifactType: ArtifactType,
  artifactId: string,
  options: { range?: TrendRange } = {},
): Promise<Trend> {
  const [totals, range] = await Promise.all([
    getTotals(artifactType, artifactId),
    options.range ?? defaultTrendRange(artifactType, artifactId),
  ]);
  return readTrend('reactions', artifactType, artifactId, range, {
    negative: totals.rottenEggTotal,
    positive: totals.medalTotal,
  });
}

/**
 * Critical people against appreciative people, each counted once, over one
 * range. Shares the shaping logic with the reaction trend but nothing else:
 * the two are separate reads of separate tables and are never plotted
 * together.
 */
export async function opinionTrend(
  artifactType: ArtifactType,
  artifactId: string,
  options: { range?: TrendRange } = {},
): Promise<Trend> {
  const [totals, range] = await Promise.all([
    getTotals(artifactType, artifactId),
    options.range ?? defaultTrendRange(artifactType, artifactId),
  ]);
  return readTrend('people', artifactType, artifactId, range, {
    negative: totals.negativeOpinionTotal,
    positive: totals.positiveOpinionTotal,
  });
}

/** Both histories for one artifact over the same range, fetched in parallel and kept apart. */
export async function artifactTrends(
  artifactType: ArtifactType,
  artifactId: string,
  options: { range?: TrendRange } = {},
): Promise<ArtifactTrends> {
  const [totals, range] = await Promise.all([
    getTotals(artifactType, artifactId),
    options.range ?? defaultTrendRange(artifactType, artifactId),
  ]);

  const [reactions, opinions] = await Promise.all([
    readTrend('reactions', artifactType, artifactId, range, {
      negative: totals.rottenEggTotal,
      positive: totals.medalTotal,
    }),
    readTrend('people', artifactType, artifactId, range, {
      negative: totals.negativeOpinionTotal,
      positive: totals.positiveOpinionTotal,
    }),
  ]);

  return { range, reactions, opinions };
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

interface OpinionBucket {
  type: string;
  id: string;
  at: string;
  positive: number;
  negative: number;
}

/**
 * Replays recorded opinions, and every change of side, into hourly buckets.
 *
 * Exact rather than approximate, unlike its reaction counterpart: an opinion
 * row carries the moment the side was first taken and each change carries its
 * own moment, so the history can be reconstructed as it happened. A person
 * who switched appears once on their original side at the start and then
 * moves across at the time they moved — never counted on both at once.
 */
async function replayOpinions(scope?: { artifactType: ArtifactType; artifactId: string }): Promise<Map<string, OpinionBucket>> {
  const where = scope ? 'WHERE artifact_type = $1 AND artifact_id = $2' : '';
  const params = scope ? [scope.artifactType, scope.artifactId] : [];

  const [opinions, changes] = await Promise.all([
    query<{ user_id: string; artifact_type: string; artifact_id: string; created_at: string; stance: string }>(
      `SELECT user_id, artifact_type, artifact_id, created_at, stance FROM opinions ${where}`,
      params,
    ),
    query<{ user_id: string; artifact_type: string; artifact_id: string; from_stance: string; to_stance: string; created_at: string }>(
      `SELECT user_id, artifact_type, artifact_id, from_stance, to_stance, created_at
         FROM opinion_changes ${where} ORDER BY created_at`,
      params,
    ),
  ]);

  const changesByPerson = new Map<string, typeof changes>();
  for (const change of changes) {
    const key = `${change.artifact_type}:${change.artifact_id}:${change.user_id}`;
    const list = changesByPerson.get(key) ?? [];
    list.push(change);
    changesByPerson.set(key, list);
  }

  const buckets = new Map<string, OpinionBucket>();
  const add = (type: string, id: string, iso: string, stance: string, delta: number) => {
    const at = hourBucket(iso);
    const key = `${type}:${id}:${at}`;
    const bucket = buckets.get(key) ?? { type, id, at, positive: 0, negative: 0 };
    if (stance === 'positive') bucket.positive += delta;
    else bucket.negative += delta;
    buckets.set(key, bucket);
  };

  for (const opinion of opinions) {
    const history = changesByPerson.get(`${opinion.artifact_type}:${opinion.artifact_id}:${opinion.user_id}`) ?? [];
    // The side they first took is the one their first change moved them away from.
    const original = history[0]?.from_stance ?? opinion.stance;
    add(opinion.artifact_type, opinion.artifact_id, opinion.created_at, original, 1);
    for (const change of history) {
      add(change.artifact_type, change.artifact_id, change.created_at, change.from_stance, -1);
      add(change.artifact_type, change.artifact_id, change.created_at, change.to_stance, 1);
    }
  }

  return buckets;
}

/** Rebuilds one artifact's opinion history from the opinion rows and their changes. */
export async function rebuildOpinionTimelineFor(artifactType: ArtifactType, artifactId: string): Promise<void> {
  await execute('DELETE FROM opinion_timeline WHERE artifact_type = $1 AND artifact_id = $2', [
    artifactType,
    artifactId,
  ]);

  for (const bucket of (await replayOpinions({ artifactType, artifactId })).values()) {
    await execute(
      `INSERT INTO opinion_timeline (artifact_type, artifact_id, bucket_start, positive_count, negative_count)
       VALUES ($1, $2, $3, $4, $5)`,
      [artifactType, artifactId, bucket.at, bucket.positive, bucket.negative],
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

  const buckets = [...(await replayOpinions()).values()].filter(
    (bucket) => !covered.has(`${bucket.type}:${bucket.id}`),
  );

  for (const bucket of buckets) {
    await execute(
      `INSERT INTO opinion_timeline (artifact_type, artifact_id, bucket_start, positive_count, negative_count)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (artifact_type, artifact_id, bucket_start) DO NOTHING`,
      [bucket.type, bucket.id, bucket.at, bucket.positive, bucket.negative],
    );
  }

  return buckets.length;
}
