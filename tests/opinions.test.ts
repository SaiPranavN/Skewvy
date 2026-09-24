import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  truncateAll,
  createTestEntity,
  createTestFlashNews,
  createVerifiedUser,
} from './helpers';
import { applyReactionBatch } from '@/lib/services/reactions';
import { switchOpinion } from '@/lib/services/opinions';
import { getTotals, getContribution, recomputeTotals } from '@/lib/services/totals';
import { opinionTrend, rebuildOpinionTimelineFor } from '@/lib/services/timeline';
import { query } from '@/lib/db';

beforeAll(setupTestDatabase);
afterAll(teardownTestDatabase);
beforeEach(truncateAll);

/**
 * Changing sides on an Entity. The opinion moves; nothing the person already
 * sent is taken back.
 */
describe('switching sides on an entity', () => {
  async function appreciativeFan() {
    const entityId = await createTestEntity();
    const userId = await createVerifiedUser();
    await applyReactionBatch({
      userId, artifactType: 'entity', artifactId: entityId,
      reactionType: 'medal', quantity: 314, clientBatchId: 'fan-medals',
    });
    return { entityId, userId };
  }

  it('moves the head count across and keeps every reaction already sent', async () => {
    const { entityId, userId } = await appreciativeFan();

    const outcome = await switchOpinion({ userId, artifactType: 'entity', artifactId: entityId, stance: 'negative' });
    expect(outcome.status).toBe('switched');

    const totals = await getTotals('entity', entityId);
    expect(totals.positiveOpinionTotal).toBe(0);
    expect(totals.negativeOpinionTotal).toBe(1);
    // The Medals happened. They stay in the total and in the person's record.
    expect(totals.medalTotal).toBe(314);
    expect(totals.medalContributorTotal).toBe(1);
    expect(totals.uniqueParticipantTotal).toBe(1);

    const contribution = await getContribution(userId, 'entity', entityId);
    expect(contribution.stance).toBe('negative');
    expect(contribution.medalCount).toBe(314);
  });

  it('opens the new side and closes the old one', async () => {
    const { entityId, userId } = await appreciativeFan();
    await switchOpinion({ userId, artifactType: 'entity', artifactId: entityId, stance: 'negative' });

    const eggs = await applyReactionBatch({
      userId, artifactType: 'entity', artifactId: entityId,
      reactionType: 'rotten_egg', quantity: 12, clientBatchId: 'after-switch-eggs',
    });
    expect(eggs.applied).toBe(true);
    // Their first Egg makes them an Egg contributor, once.
    expect(eggs.totals.rottenEggContributorTotal).toBe(1);
    // Switching does not count them as a second opinion.
    expect(eggs.totals.negativeOpinionTotal).toBe(1);
    expect(eggs.totals.positiveOpinionTotal).toBe(0);

    const medals = await applyReactionBatch({
      userId, artifactType: 'entity', artifactId: entityId,
      reactionType: 'medal', quantity: 5, clientBatchId: 'old-side-medals',
    });
    expect(medals.applied).toBe(false);
    expect(medals.lockedTo).toBe('negative');
    expect(medals.totals.medalTotal).toBe(314);
  });

  it('never lets a reaction switch sides on its own', async () => {
    const { entityId, userId } = await appreciativeFan();

    const crossing = await applyReactionBatch({
      userId, artifactType: 'entity', artifactId: entityId,
      reactionType: 'rotten_egg', quantity: 3, clientBatchId: 'implicit-switch',
    });

    expect(crossing.applied).toBe(false);
    expect((await getContribution(userId, 'entity', entityId)).stance).toBe('positive');
  });

  it('refuses on a Flash News item, where a side is final', async () => {
    const storyId = await createTestFlashNews();
    const userId = await createVerifiedUser();
    await applyReactionBatch({
      userId, artifactType: 'flash_news', artifactId: storyId,
      reactionType: 'medal', quantity: 4, clientBatchId: 'story-medals',
    });

    const outcome = await switchOpinion({ userId, artifactType: 'flash_news', artifactId: storyId, stance: 'negative' });

    expect(outcome.status).toBe('final');
    const totals = await getTotals('flash_news', storyId);
    expect(totals.positiveOpinionTotal).toBe(1);
    expect(totals.negativeOpinionTotal).toBe(0);
    expect(await query('SELECT * FROM opinion_changes')).toHaveLength(0);
  });

  it('has nothing to switch before a side has been taken', async () => {
    const entityId = await createTestEntity();
    const userId = await createVerifiedUser();

    const outcome = await switchOpinion({ userId, artifactType: 'entity', artifactId: entityId, stance: 'positive' });

    expect(outcome.status).toBe('no_opinion');
    expect((await getTotals('entity', entityId)).positiveOpinionTotal).toBe(0);
  });

  it('treats a switch to the side already held as no change', async () => {
    const { entityId, userId } = await appreciativeFan();

    const outcome = await switchOpinion({ userId, artifactType: 'entity', artifactId: entityId, stance: 'positive' });

    expect(outcome.status).toBe('unchanged');
    expect((await getTotals('entity', entityId)).positiveOpinionTotal).toBe(1);
    expect(await query('SELECT * FROM opinion_changes')).toHaveLength(0);
  });

  it('keeps every change on record, and nets correctly over several', async () => {
    const { entityId, userId } = await appreciativeFan();

    for (const stance of ['negative', 'positive', 'negative'] as const) {
      await switchOpinion({ userId, artifactType: 'entity', artifactId: entityId, stance });
    }

    const changes = await query<{ from_stance: string; to_stance: string }>(
      'SELECT from_stance, to_stance FROM opinion_changes ORDER BY created_at',
    );
    expect(changes.map((change) => `${change.from_stance}>${change.to_stance}`)).toEqual([
      'positive>negative',
      'negative>positive',
      'positive>negative',
    ]);

    const totals = await getTotals('entity', entityId);
    expect(totals.positiveOpinionTotal).toBe(0);
    expect(totals.negativeOpinionTotal).toBe(1);

    // The stored totals agree with a rebuild from the underlying rows.
    const recomputed = await recomputeTotals('entity', entityId);
    expect(recomputed.positiveOpinionTotal).toBe(0);
    expect(recomputed.negativeOpinionTotal).toBe(1);
    expect(recomputed.medalContributorTotal).toBe(1);
  });

  it('moves the opinion history too, and rebuilds it exactly', async () => {
    const { entityId, userId } = await appreciativeFan();
    const other = await createVerifiedUser('other@example.test');
    await applyReactionBatch({
      userId: other, artifactType: 'entity', artifactId: entityId,
      reactionType: 'medal', quantity: 1, clientBatchId: 'other-medal',
    });

    await switchOpinion({ userId, artifactType: 'entity', artifactId: entityId, stance: 'negative' });

    const live = await opinionTrend('entity', entityId);
    const last = live.points[live.points.length - 1];
    expect(last.cumulativePositive).toBe(1);
    expect(last.cumulativeNegative).toBe(1);

    // A rebuild from opinions + changes must land on the same history.
    const before = await query('SELECT bucket_start, positive_count, negative_count FROM opinion_timeline ORDER BY bucket_start');
    await rebuildOpinionTimelineFor('entity', entityId);
    const after = await query('SELECT bucket_start, positive_count, negative_count FROM opinion_timeline ORDER BY bucket_start');
    expect(after).toEqual(before);
  });
});
