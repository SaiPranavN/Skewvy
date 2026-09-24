import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  truncateAll,
  createTestFlashNews,
  createVerifiedUser,
} from './helpers';
import { applyReactionBatch } from '@/lib/services/reactions';
import {
  reactionTrend,
  opinionTrend,
  artifactTrends,
  hourBucket,
  backfillReactionTimeline,
  backfillOpinionTimeline,
} from '@/lib/services/timeline';
import { getTotals } from '@/lib/services/totals';
import { execute, query } from '@/lib/db';

beforeAll(setupTestDatabase);
afterAll(teardownTestDatabase);
beforeEach(truncateAll);

describe('reaction timeline', () => {
  it('rolls reactions into hourly buckets rather than one row per tap', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();

    for (let index = 0; index < 4; index += 1) {
      await applyReactionBatch({
        userId,
        artifactType: 'flash_news',
        artifactId,
        reactionType: 'rotten_egg',
        quantity: 10,
        clientBatchId: `bucket-batch-${index}`,
      });
    }

    const rows = await query<{ rotten_egg_count: number }>(
      'SELECT rotten_egg_count FROM reaction_timeline WHERE artifact_type = $1 AND artifact_id = $2',
      ['flash_news', artifactId],
    );

    expect(rows).toHaveLength(1);
    expect(Number(rows[0].rotten_egg_count)).toBe(40);
  });

  it('ends the running total exactly on the artifact’s lifetime total', async () => {
    const artifactId = await createTestFlashNews();
    const now = Date.now();

    // Three hours of recorded history, written directly so the clock is fixed.
    for (let hoursAgo = 3; hoursAgo >= 1; hoursAgo -= 1) {
      await execute(
        `INSERT INTO reaction_timeline (artifact_type, artifact_id, bucket_start, rotten_egg_count, medal_count)
         VALUES ($1, $2, $3, $4, $5)`,
        ['flash_news', artifactId, hourBucket(now - hoursAgo * 3_600_000), hoursAgo * 10, hoursAgo * 4],
      );
    }
    await execute(
      `INSERT INTO artifact_totals (artifact_type, artifact_id, rotten_egg_total, medal_total,
        positive_opinion_total, negative_opinion_total, unique_participant_total, updated_at)
       VALUES ($1, $2, 60, 24, 0, 0, 0, $3)`,
      ['flash_news', artifactId, new Date().toISOString()],
    );

    const trend = await reactionTrend('flash_news', artifactId);
    const totals = await getTotals('flash_news', artifactId);
    const last = trend.points[trend.points.length - 1];

    expect(trend.resolution).toBe('hour');
    expect(last.cumulativeNegative).toBe(totals.rottenEggTotal);
    expect(last.cumulativePositive).toBe(totals.medalTotal);
  });

  it('carries reactions older than the rollup in the opening figure', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();

    // A total that predates any recorded history.
    await execute(
      `INSERT INTO artifact_totals (artifact_type, artifact_id, rotten_egg_total, medal_total,
        positive_opinion_total, negative_opinion_total, unique_participant_total, updated_at)
       VALUES ($1, $2, 1000, 0, 0, 0, 0, $3)`,
      ['flash_news', artifactId, new Date().toISOString()],
    );
    await execute(
      `INSERT INTO reaction_timeline (artifact_type, artifact_id, bucket_start, rotten_egg_count, medal_count)
       VALUES ($1, $2, $3, 0, 0)`,
      ['flash_news', artifactId, hourBucket(Date.now() - 2 * 3_600_000)],
    );

    await applyReactionBatch({
      userId,
      artifactType: 'flash_news',
      artifactId,
      reactionType: 'rotten_egg',
      quantity: 25,
      clientBatchId: 'opening-batch',
    });

    const trend = await reactionTrend('flash_news', artifactId);
    const last = trend.points[trend.points.length - 1];

    expect(trend.openingNegative).toBe(1000);
    expect(trend.windowNegative).toBe(25);
    expect(last.cumulativeNegative).toBe(1025);
  });

  it('fills quiet buckets instead of leaving gaps', async () => {
    const artifactId = await createTestFlashNews();
    const now = Date.now();

    for (const hoursAgo of [5, 1]) {
      await execute(
        `INSERT INTO reaction_timeline (artifact_type, artifact_id, bucket_start, rotten_egg_count, medal_count)
         VALUES ($1, $2, $3, 5, 5)`,
        ['flash_news', artifactId, hourBucket(now - hoursAgo * 3_600_000)],
      );
    }

    const trend = await reactionTrend('flash_news', artifactId);

    expect(trend.points.length).toBeGreaterThanOrEqual(5);
    // The running total never falls back, even across a silent hour.
    for (let index = 1; index < trend.points.length; index += 1) {
      expect(trend.points[index].cumulativeNegative).toBeGreaterThanOrEqual(trend.points[index - 1].cumulativeNegative);
    }
  });

  it('reconstructs history for artifacts recorded before the rollup existed', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();
    const when = new Date(Date.now() - 6 * 3_600_000).toISOString();

    await execute(
      `INSERT INTO reaction_aggregates (id, user_id, artifact_type, artifact_id, rotten_egg_count, medal_count, created_at, updated_at)
       VALUES ($1, $2, 'flash_news', $3, 12, 0, $4, $4)`,
      [crypto.randomUUID(), userId, artifactId, when],
    );

    const filled = await backfillReactionTimeline();
    expect(filled).toBe(1);

    const rows = await query<{ bucket_start: string; rotten_egg_count: number }>(
      'SELECT bucket_start, rotten_egg_count FROM reaction_timeline WHERE artifact_id = $1',
      [artifactId],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].rotten_egg_count)).toBe(12);

    // Running it again leaves the recorded history alone.
    expect(await backfillReactionTimeline()).toBe(0);
  });

  it('returns no points for an artifact nobody has reacted to', async () => {
    const artifactId = await createTestFlashNews();
    const trend = await reactionTrend('flash_news', artifactId);
    expect(trend.points).toHaveLength(0);
  });
});

/**
 * The second history, which counts people rather than taps. It must never move
 * more than once per person, and it must never be confused with the first.
 */
describe('opinion timeline', () => {
  it('records a person once, on the batch that commits their side', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();

    for (let index = 0; index < 6; index += 1) {
      await applyReactionBatch({
        userId,
        artifactType: 'flash_news',
        artifactId,
        reactionType: 'rotten_egg',
        quantity: 40,
        clientBatchId: `opinion-bucket-${index}`,
      });
    }

    const rows = await query<{ negative_count: number; positive_count: number }>(
      'SELECT negative_count, positive_count FROM opinion_timeline WHERE artifact_id = $1',
      [artifactId],
    );

    expect(rows).toHaveLength(1);
    // 240 taps, one person.
    expect(Number(rows[0].negative_count)).toBe(1);
    expect(Number(rows[0].positive_count)).toBe(0);
  });

  it('is read on its own scale, not the reaction one', async () => {
    const artifactId = await createTestFlashNews();

    for (let index = 0; index < 3; index += 1) {
      const userId = await createVerifiedUser(`voice-${index}@example.test`);
      await applyReactionBatch({
        userId,
        artifactType: 'flash_news',
        artifactId,
        reactionType: index === 0 ? 'rotten_egg' : 'medal',
        quantity: index === 0 ? 200 : 4,
        clientBatchId: `voice-${index}`,
      });
    }

    const { reactions, opinions } = await artifactTrends('flash_news', artifactId);

    expect(reactions.measures).toBe('reactions');
    expect(opinions.measures).toBe('people');

    const lastReactions = reactions.points[reactions.points.length - 1];
    const lastOpinions = opinions.points[opinions.points.length - 1];

    expect(lastReactions.cumulativeNegative).toBe(200);
    expect(lastReactions.cumulativePositive).toBe(8);
    // The same crowd, counted as people, says something quite different.
    expect(lastOpinions.cumulativeNegative).toBe(1);
    expect(lastOpinions.cumulativePositive).toBe(2);
  });

  it('ends on the artifact’s lifetime opinion totals', async () => {
    const artifactId = await createTestFlashNews();
    for (let index = 0; index < 4; index += 1) {
      const userId = await createVerifiedUser(`tail-${index}@example.test`);
      await applyReactionBatch({
        userId,
        artifactType: 'flash_news',
        artifactId,
        reactionType: 'medal',
        quantity: 2,
        clientBatchId: `tail-${index}`,
      });
    }

    const trend = await opinionTrend('flash_news', artifactId);
    const totals = await getTotals('flash_news', artifactId);
    const last = trend.points[trend.points.length - 1];

    expect(last.cumulativePositive).toBe(totals.positiveOpinionTotal);
    expect(last.cumulativeNegative).toBe(totals.negativeOpinionTotal);
  });

  it('returns no points for an artifact nobody has taken a side on', async () => {
    const artifactId = await createTestFlashNews();
    const trend = await opinionTrend('flash_news', artifactId);
    expect(trend.points).toHaveLength(0);
    expect(trend.measures).toBe('people');
  });

  it('reconstructs exactly for opinions recorded before the rollup existed', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();
    const when = new Date(Date.now() - 5 * 3_600_000).toISOString();

    await execute(
      `INSERT INTO opinions (id, user_id, artifact_type, artifact_id, stance, created_at, updated_at)
       VALUES ($1, $2, 'flash_news', $3, 'negative', $4, $4)`,
      [crypto.randomUUID(), userId, artifactId, when],
    );

    expect(await backfillOpinionTimeline()).toBe(1);

    const rows = await query<{ bucket_start: string; negative_count: number }>(
      'SELECT bucket_start, negative_count FROM opinion_timeline WHERE artifact_id = $1',
      [artifactId],
    );
    expect(rows).toHaveLength(1);
    // Exact, not approximate: the opinion row carries its own timestamp.
    expect(rows[0].bucket_start).toBe(hourBucket(when));
    expect(Number(rows[0].negative_count)).toBe(1);

    // Running it again leaves the recorded history alone.
    expect(await backfillOpinionTimeline()).toBe(0);
  });
});

/**
 * Historical ranges. The same two histories, read over windows from a day to
 * five years, each at a bucket size that keeps the chart legible.
 */
describe('trend ranges', () => {
  async function seedHistory(artifactId: string, daysAgo: number[], eggsEach = 10) {
    for (const ago of daysAgo) {
      await execute(
        `INSERT INTO reaction_timeline (artifact_type, artifact_id, bucket_start, rotten_egg_count, medal_count)
         VALUES ('flash_news', $1, $2, $3, 0)`,
        [artifactId, hourBucket(Date.now() - ago * 86_400_000), eggsEach],
      );
    }
    const total = daysAgo.length * eggsEach;
    await execute(
      `INSERT INTO artifact_totals (artifact_type, artifact_id, rotten_egg_total, medal_total,
        positive_opinion_total, negative_opinion_total, unique_participant_total, updated_at)
       VALUES ('flash_news', $1, $2, 0, 0, 0, 0, $3)`,
      [artifactId, total, new Date().toISOString()],
    );
    return total;
  }

  it('reads a month day by day, ending on the lifetime total', async () => {
    const artifactId = await createTestFlashNews();
    const total = await seedHistory(artifactId, [20, 12, 3, 1]);

    const trend = await reactionTrend('flash_news', artifactId, { range: '1m' });

    expect(trend.range).toBe('1m');
    expect(trend.resolution).toBe('day');
    expect(trend.points[trend.points.length - 1].cumulativeNegative).toBe(total);
  });

  it('folds activity older than the window into its opening figure', async () => {
    const artifactId = await createTestFlashNews();
    await seedHistory(artifactId, [200, 100, 3, 2]);

    const week = await reactionTrend('flash_news', artifactId, { range: '1w' });

    // Two buckets fall inside the week; the rest is where the line starts.
    expect(week.windowNegative).toBe(20);
    expect(week.openingNegative).toBe(20);
    expect(week.points[0].cumulativeNegative).toBe(20);
    expect(week.points[week.points.length - 1].cumulativeNegative).toBe(40);
  });

  it('starts a long range where the history does, not years before it', async () => {
    const artifactId = await createTestFlashNews();
    await seedHistory(artifactId, [4]);

    const fiveYears = await reactionTrend('flash_news', artifactId, { range: '5y' });

    expect(fiveYears.resolution).toBe('month');
    // One bucket in front of the first activity gives the line somewhere to
    // rise from, so even a single month of history is drawable.
    expect(fiveYears.points.length).toBeGreaterThanOrEqual(2);
    expect(fiveYears.points.length).toBeLessThanOrEqual(3);
    expect(fiveYears.points[0].cumulativeNegative).toBe(0);
  });

  it('opens on the smallest range that holds the whole history', async () => {
    const young = await createTestFlashNews('young');
    await seedHistory(young, [0.2]);
    const old = await createTestFlashNews('old');
    await seedHistory(old, [100]);

    expect((await artifactTrends('flash_news', young)).range).toBe('24h');
    expect((await artifactTrends('flash_news', old)).range).toBe('6m');
  });

  it('keeps both charts on the same range', async () => {
    const artifactId = await createTestFlashNews();
    await seedHistory(artifactId, [40]);

    const trends = await artifactTrends('flash_news', artifactId, { range: '1y' });

    expect(trends.range).toBe('1y');
    expect(trends.reactions.range).toBe('1y');
    expect(trends.opinions.range).toBe('1y');
    expect(trends.reactions.resolution).toBe('week');
  });
});
