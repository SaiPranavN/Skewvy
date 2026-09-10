import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  truncateAll,
  createTestFlashNews,
  createTestEntity,
  createVerifiedUser,
} from './helpers';
import { applyReactionBatch, artifactIsReactable } from '@/lib/services/reactions';
import { getTotals, getContribution, recomputeTotals } from '@/lib/services/totals';
import { query } from '@/lib/db';

beforeAll(setupTestDatabase);
afterAll(teardownTestDatabase);
beforeEach(truncateAll);

describe('reaction batches', () => {
  it('increments the artifact total and the sender’s own contribution', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();

    const result = await applyReactionBatch({
      userId,
      artifactType: 'flash_news',
      artifactId,
      reactionType: 'rotten_egg',
      quantity: 24,
      clientBatchId: 'batch-1',
    });

    expect(result.applied).toBe(true);
    expect(result.totals.rottenEggTotal).toBe(24);
    expect(result.contribution.rottenEggCount).toBe(24);
    expect(result.totals.uniqueParticipantTotal).toBe(1);
  });

  it('records aggregates, not one row per tap', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();

    for (let index = 0; index < 5; index += 1) {
      await applyReactionBatch({
        userId,
        artifactType: 'flash_news',
        artifactId,
        reactionType: 'rotten_egg',
        quantity: 20,
        clientBatchId: `batch-${index}`,
      });
    }

    const aggregates = await query('SELECT * FROM reaction_aggregates');
    expect(aggregates).toHaveLength(1);

    const totals = await getTotals('flash_news', artifactId);
    expect(totals.rottenEggTotal).toBe(100);
    expect(totals.uniqueParticipantTotal).toBe(1);
  });

  it('is idempotent on the client batch id, so retries cannot double-count', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();

    const first = await applyReactionBatch({
      userId,
      artifactType: 'flash_news',
      artifactId,
      reactionType: 'medal',
      quantity: 30,
      clientBatchId: 'retry-me',
    });
    const retry = await applyReactionBatch({
      userId,
      artifactType: 'flash_news',
      artifactId,
      reactionType: 'medal',
      quantity: 30,
      clientBatchId: 'retry-me',
    });

    expect(first.applied).toBe(true);
    expect(retry.applied).toBe(false);
    expect(retry.totals.medalTotal).toBe(30);
    expect(retry.contribution.medalCount).toBe(30);
  });

  it('lets the same client batch id from a different person through', async () => {
    const artifactId = await createTestFlashNews();
    const userA = await createVerifiedUser('a@example.test');
    const userB = await createVerifiedUser('b@example.test');

    await applyReactionBatch({
      userId: userA,
      artifactType: 'flash_news',
      artifactId,
      reactionType: 'medal',
      quantity: 5,
      clientBatchId: 'shared-id',
    });
    const second = await applyReactionBatch({
      userId: userB,
      artifactType: 'flash_news',
      artifactId,
      reactionType: 'medal',
      quantity: 5,
      clientBatchId: 'shared-id',
    });

    expect(second.applied).toBe(true);
    expect(second.totals.medalTotal).toBe(10);
    expect(second.totals.uniqueParticipantTotal).toBe(2);
  });

  it('keeps entity and flash news counters separate', async () => {
    const entityId = await createTestEntity();
    const flashNewsId = await createTestFlashNews();
    const userId = await createVerifiedUser();

    await applyReactionBatch({
      userId,
      artifactType: 'entity',
      artifactId: entityId,
      reactionType: 'rotten_egg',
      quantity: 10,
      clientBatchId: 'e1',
    });
    await applyReactionBatch({
      userId,
      artifactType: 'flash_news',
      artifactId: flashNewsId,
      reactionType: 'medal',
      quantity: 7,
      clientBatchId: 'f1',
    });

    expect((await getTotals('entity', entityId)).rottenEggTotal).toBe(10);
    expect((await getTotals('entity', entityId)).medalTotal).toBe(0);
    expect((await getTotals('flash_news', flashNewsId)).medalTotal).toBe(7);
  });

  it('only accepts reactions for published artifacts', async () => {
    const artifactId = await createTestFlashNews();
    expect(await artifactIsReactable('flash_news', artifactId)).toBe(true);
    expect(await artifactIsReactable('flash_news', 'does-not-exist')).toBe(false);
  });

  it('recomputes totals from the underlying rows', async () => {
    const artifactId = await createTestFlashNews();
    const userA = await createVerifiedUser('a@example.test');
    const userB = await createVerifiedUser('b@example.test');

    await applyReactionBatch({
      userId: userA, artifactType: 'flash_news', artifactId,
      reactionType: 'rotten_egg', quantity: 40, clientBatchId: 'a1',
    });
    await applyReactionBatch({
      userId: userB, artifactType: 'flash_news', artifactId,
      reactionType: 'medal', quantity: 12, clientBatchId: 'b1',
    });

    const recomputed = await recomputeTotals('flash_news', artifactId);
    expect(recomputed.rottenEggTotal).toBe(40);
    expect(recomputed.medalTotal).toBe(12);
    expect(recomputed.negativeOpinionTotal).toBe(1);
    expect(recomputed.positiveOpinionTotal).toBe(1);
    expect(recomputed.uniqueParticipantTotal).toBe(2);
  });
});

describe('opinions', () => {
  it('records exactly one opinion no matter how many reactions are sent', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();

    for (let index = 0; index < 10; index += 1) {
      await applyReactionBatch({
        userId, artifactType: 'flash_news', artifactId,
        reactionType: 'rotten_egg', quantity: 25, clientBatchId: `many-${index}`,
      });
    }

    const opinions = await query('SELECT * FROM opinions WHERE user_id = $1', [userId]);
    expect(opinions).toHaveLength(1);

    const totals = await getTotals('flash_news', artifactId);
    expect(totals.rottenEggTotal).toBe(250);
    expect(totals.negativeOpinionTotal).toBe(1);
  });

  it('moves an existing opinion across instead of creating a second one', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();

    await applyReactionBatch({
      userId, artifactType: 'flash_news', artifactId,
      reactionType: 'rotten_egg', quantity: 100, clientBatchId: 'neg',
    });
    const afterSwitch = await applyReactionBatch({
      userId, artifactType: 'flash_news', artifactId,
      reactionType: 'medal', quantity: 3, clientBatchId: 'pos',
    });

    const opinions = await query<{ stance: string }>('SELECT stance FROM opinions WHERE user_id = $1', [userId]);
    expect(opinions).toHaveLength(1);
    expect(opinions[0].stance).toBe('positive');

    expect(afterSwitch.totals.negativeOpinionTotal).toBe(0);
    expect(afterSwitch.totals.positiveOpinionTotal).toBe(1);
    // Reactions already sent are intensity, and are never taken back.
    expect(afterSwitch.totals.rottenEggTotal).toBe(100);
    expect(afterSwitch.contribution.rottenEggCount).toBe(100);
    expect(afterSwitch.contribution.medalCount).toBe(3);
    // The person is still one participant, not two.
    expect(afterSwitch.totals.uniqueParticipantTotal).toBe(1);
  });

  it('counts people once and taps in full across a crowd', async () => {
    const artifactId = await createTestFlashNews();
    const users = await Promise.all(
      Array.from({ length: 5 }, (_, index) => createVerifiedUser(`crowd-${index}@example.test`)),
    );

    for (const [index, userId] of users.entries()) {
      await applyReactionBatch({
        userId, artifactType: 'flash_news', artifactId,
        reactionType: index < 3 ? 'rotten_egg' : 'medal',
        quantity: 50, clientBatchId: `crowd-${index}`,
      });
    }

    const totals = await getTotals('flash_news', artifactId);
    expect(totals.rottenEggTotal).toBe(150);
    expect(totals.medalTotal).toBe(100);
    expect(totals.negativeOpinionTotal).toBe(3);
    expect(totals.positiveOpinionTotal).toBe(2);
    expect(totals.uniqueParticipantTotal).toBe(5);
  });

  it('reports the viewer’s own contribution separately from the public totals', async () => {
    const artifactId = await createTestFlashNews();
    const mine = await createVerifiedUser('mine@example.test');
    const theirs = await createVerifiedUser('theirs@example.test');

    await applyReactionBatch({
      userId: mine, artifactType: 'flash_news', artifactId,
      reactionType: 'medal', quantity: 8, clientBatchId: 'm1',
    });
    await applyReactionBatch({
      userId: theirs, artifactType: 'flash_news', artifactId,
      reactionType: 'medal', quantity: 400 > 250 ? 250 : 400, clientBatchId: 't1',
    });

    const contribution = await getContribution(mine, 'flash_news', artifactId);
    expect(contribution.medalCount).toBe(8);
    expect(contribution.stance).toBe('positive');

    const totals = await getTotals('flash_news', artifactId);
    expect(totals.medalTotal).toBe(258);
  });
});
