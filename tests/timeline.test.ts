import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  truncateAll,
  createTestFlashNews,
  createVerifiedUser,
} from './helpers';
import { applyReactionBatch } from '@/lib/services/reactions';
import { reactionTrend, hourBucket, backfillReactionTimeline } from '@/lib/services/timeline';
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
    expect(last.cumulativeEggs).toBe(totals.rottenEggTotal);
    expect(last.cumulativeMedals).toBe(totals.medalTotal);
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

    expect(trend.openingEggs).toBe(1000);
    expect(trend.windowEggs).toBe(25);
    expect(last.cumulativeEggs).toBe(1025);
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
      expect(trend.points[index].cumulativeEggs).toBeGreaterThanOrEqual(trend.points[index - 1].cumulativeEggs);
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
