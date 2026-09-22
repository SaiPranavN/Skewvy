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
import {
  getTotals,
  getContribution,
  recomputeTotals,
  backfillContributorTotals,
} from '@/lib/services/totals';
import { execute, query } from '@/lib/db';

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
    expect(recomputed.rottenEggContributorTotal).toBe(1);
    expect(recomputed.medalContributorTotal).toBe(1);
  });
});

/**
 * The distinction the whole product turns on: a reaction total is unbounded per
 * person, and the contributor total beside it is a head count that moves once.
 */
describe('contributor totals', () => {
  it('counts one person once, however many reactions they send', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();

    for (let index = 0; index < 4; index += 1) {
      await applyReactionBatch({
        userId, artifactType: 'flash_news', artifactId,
        reactionType: 'rotten_egg', quantity: 25, clientBatchId: `solo-${index}`,
      });
    }

    const totals = await getTotals('flash_news', artifactId);
    expect(totals.rottenEggTotal).toBe(100);
    expect(totals.rottenEggContributorTotal).toBe(1);
    expect(totals.medalContributorTotal).toBe(0);
  });

  it('separates a loud minority from a quiet majority', async () => {
    const artifactId = await createTestFlashNews();

    // Five appreciative people sending ten Medals each.
    for (let index = 0; index < 5; index += 1) {
      const userId = await createVerifiedUser(`fan-${index}@example.test`);
      await applyReactionBatch({
        userId, artifactType: 'flash_news', artifactId,
        reactionType: 'medal', quantity: 10, clientBatchId: `fan-${index}`,
      });
    }

    // One critical person sending a hundred Rotten Eggs.
    const critic = await createVerifiedUser('critic@example.test');
    await applyReactionBatch({
      userId: critic, artifactType: 'flash_news', artifactId,
      reactionType: 'rotten_egg', quantity: 100, clientBatchId: 'critic-1',
    });

    const totals = await getTotals('flash_news', artifactId);

    // The reaction totals say the eggs win by two to one.
    expect(totals.rottenEggTotal).toBe(100);
    expect(totals.medalTotal).toBe(50);

    // The people say the opposite, and that is the public verdict.
    expect(totals.negativeOpinionTotal).toBe(1);
    expect(totals.positiveOpinionTotal).toBe(5);
    expect(totals.rottenEggContributorTotal).toBe(1);
    expect(totals.medalContributorTotal).toBe(5);
  });

  it('does not credit a contributor for a batch the server refused', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();

    await applyReactionBatch({
      userId, artifactType: 'flash_news', artifactId,
      reactionType: 'medal', quantity: 3, clientBatchId: 'first-side',
    });
    await applyReactionBatch({
      userId, artifactType: 'flash_news', artifactId,
      reactionType: 'rotten_egg', quantity: 50, clientBatchId: 'crossing',
    });

    const totals = await getTotals('flash_news', artifactId);
    expect(totals.rottenEggTotal).toBe(0);
    expect(totals.rottenEggContributorTotal).toBe(0);
    expect(totals.medalContributorTotal).toBe(1);
  });

  it('is filled in for artifacts written before the columns existed', async () => {
    const artifactId = await createTestFlashNews();
    const userA = await createVerifiedUser('old-a@example.test');
    const userB = await createVerifiedUser('old-b@example.test');

    await applyReactionBatch({
      userId: userA, artifactType: 'flash_news', artifactId,
      reactionType: 'rotten_egg', quantity: 30, clientBatchId: 'old-a',
    });
    await applyReactionBatch({
      userId: userB, artifactType: 'flash_news', artifactId,
      reactionType: 'rotten_egg', quantity: 5, clientBatchId: 'old-b',
    });

    // Reproduce the pre-migration state: totals intact, head counts zeroed.
    await execute(
      `UPDATE artifact_totals SET rotten_egg_contributor_total = 0, medal_contributor_total = 0
        WHERE artifact_id = $1`,
      [artifactId],
    );

    expect(await backfillContributorTotals()).toBe(1);
    expect((await getTotals('flash_news', artifactId)).rottenEggContributorTotal).toBe(2);

    // Nothing left to repair, so a second run is a no-op.
    expect(await backfillContributorTotals()).toBe(0);
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

  it('refuses the opposite side once a person has taken one', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();

    await applyReactionBatch({
      userId, artifactType: 'flash_news', artifactId,
      reactionType: 'rotten_egg', quantity: 100, clientBatchId: 'neg-batch-1',
    });
    const crossing = await applyReactionBatch({
      userId, artifactType: 'flash_news', artifactId,
      reactionType: 'medal', quantity: 3, clientBatchId: 'pos-batch-1',
    });

    expect(crossing.applied).toBe(false);
    expect(crossing.lockedTo).toBe('negative');

    // Nothing moved: not the Medal total, not the opinion, not the contribution.
    expect(crossing.totals.medalTotal).toBe(0);
    expect(crossing.totals.positiveOpinionTotal).toBe(0);
    expect(crossing.totals.negativeOpinionTotal).toBe(1);
    expect(crossing.contribution.medalCount).toBe(0);
    expect(crossing.contribution.stance).toBe('negative');

    const opinions = await query<{ stance: string }>('SELECT stance FROM opinions WHERE user_id = $1', [userId]);
    expect(opinions).toHaveLength(1);
    expect(opinions[0].stance).toBe('negative');
  });

  it('leaves the refused batch id unused, so the correct side still lands', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();

    await applyReactionBatch({
      userId, artifactType: 'flash_news', artifactId,
      reactionType: 'medal', quantity: 5, clientBatchId: 'first-medal-1',
    });

    const refused = await applyReactionBatch({
      userId, artifactType: 'flash_news', artifactId,
      reactionType: 'rotten_egg', quantity: 9, clientBatchId: 'reused-id-1',
    });
    expect(refused.applied).toBe(false);

    // The same id now carries an allowed reaction and must be accepted.
    const allowed = await applyReactionBatch({
      userId, artifactType: 'flash_news', artifactId,
      reactionType: 'medal', quantity: 9, clientBatchId: 'reused-id-1',
    });
    expect(allowed.applied).toBe(true);
    expect(allowed.totals.medalTotal).toBe(14);
  });

  it('keeps accepting more of the side already chosen', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser();

    for (let index = 0; index < 4; index += 1) {
      await applyReactionBatch({
        userId, artifactType: 'flash_news', artifactId,
        reactionType: 'medal', quantity: 25, clientBatchId: `more-medals-${index}`,
      });
    }

    const totals = await getTotals('flash_news', artifactId);
    expect(totals.medalTotal).toBe(100);
    expect(totals.positiveOpinionTotal).toBe(1);
    expect(totals.uniqueParticipantTotal).toBe(1);
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
