import { transaction, queryOne } from '@/lib/db';
import type { SqlExecutor } from '@/lib/db';
import { newId } from './crypto';
import { applyTotalsDelta, getTotals, getContribution } from './totals';
import { recordTimelineBatch, recordOpinionCommitment } from './timeline';
import { publishArtifactEvent } from './realtime';
import type { ArtifactTotals, ArtifactType, ReactionType, Stance, UserContribution } from '@/lib/domain/types';
import { stanceForReaction } from '@/lib/domain/types';

export interface ApplyBatchInput {
  userId: string;
  artifactType: ArtifactType;
  artifactId: string;
  reactionType: ReactionType;
  quantity: number;
  clientBatchId: string;
}

export interface ApplyBatchResult {
  /** False when this exact batch had already been recorded, so a retry is a no-op. */
  applied: boolean;
  totals: ArtifactTotals;
  contribution: UserContribution;
  stance: Stance;
  /**
   * Set when the batch was refused because it contradicts the side this person
   * already took on this artifact. Carries the stance they are held to.
   */
  lockedTo?: Stance;
}

/**
 * Records one batch of taps.
 *
 * Reactions accumulate (a person can send hundreds) while the Opinion is one
 * row per person per artifact. The two are never mixed: `rotten_egg_total`
 * counts taps, `negative_opinion_total` counts people.
 *
 * **A reaction never moves a side.** The first reaction to an artifact fixes
 * that person's opinion, and every later reaction must agree with whatever
 * their opinion currently is. A batch that contradicts it is refused outright
 * rather than moving the opinion across. On Flash News that makes the side
 * final; on an Entity the person can change it, but only deliberately, through
 * `switchOpinion` — never as a side effect of tapping the other button.
 *
 * The whole thing is idempotent on `(user_id, client_batch_id)`, so a retried
 * request can never double-count.
 */
export async function applyReactionBatch(input: ApplyBatchInput): Promise<ApplyBatchResult> {
  const stance = stanceForReaction(input.reactionType);
  const now = new Date().toISOString();

  const result = await transaction(async (tx) => {
    const existingOpinion = await tx.query<{ stance: string }>(
      'SELECT stance FROM opinions WHERE user_id = $1 AND artifact_type = $2 AND artifact_id = $3',
      [input.userId, input.artifactType, input.artifactId],
    );
    const previousStance = (existingOpinion[0]?.stance as Stance | undefined) ?? null;

    // Checked before the batch is claimed, so a refused reaction does not burn
    // its client batch id and the client can safely resend the correct side.
    if (previousStance && previousStance !== stance) {
      return { locked: previousStance } as const;
    }

    const claimed = await claimBatch(tx, input, now);
    if (!claimed) {
      // Already processed. Return authoritative state without touching counters.
      return null;
    }

    const existingAggregate = await tx.query<{ rotten_egg_count: number; medal_count: number }>(
      'SELECT rotten_egg_count, medal_count FROM reaction_aggregates WHERE user_id = $1 AND artifact_type = $2 AND artifact_id = $3',
      [input.userId, input.artifactType, input.artifactId],
    );
    const isNewParticipant = existingAggregate.length === 0;

    const eggDelta = input.reactionType === 'rotten_egg' ? input.quantity : 0;
    const medalDelta = input.reactionType === 'medal' ? input.quantity : 0;

    /*
     * A contributor count is a head count, so it moves on a person's *first*
     * reaction on that side and never again — the hundredth Rotten Egg from the
     * same account adds to the tap total alone. Read from what they had before
     * this batch, which is the only moment the distinction is visible.
     */
    const heldEggs = Number(existingAggregate[0]?.rotten_egg_count ?? 0);
    const heldMedals = Number(existingAggregate[0]?.medal_count ?? 0);
    const isFirstEgg = eggDelta > 0 && heldEggs === 0;
    const isFirstMedal = medalDelta > 0 && heldMedals === 0;

    const aggregateRows = await tx.query<{ rotten_egg_count: number; medal_count: number }>(
      `INSERT INTO reaction_aggregates (id, user_id, artifact_type, artifact_id, rotten_egg_count, medal_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       ON CONFLICT (user_id, artifact_type, artifact_id) DO UPDATE SET
         rotten_egg_count = reaction_aggregates.rotten_egg_count + $5,
         medal_count = reaction_aggregates.medal_count + $6,
         updated_at = $7
       RETURNING rotten_egg_count, medal_count`,
      [newId(), input.userId, input.artifactType, input.artifactId, eggDelta, medalDelta, now],
    );

    // One opinion row per person per artifact. It is written once and then left
    // alone: a contradicting batch never reaches here, and a matching one has
    // nothing to change.
    await tx.execute(
      `INSERT INTO opinions (id, user_id, artifact_type, artifact_id, stance, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (user_id, artifact_type, artifact_id) DO NOTHING`,
      [newId(), input.userId, input.artifactType, input.artifactId, stance, now],
    );

    // Rolled up in the same transaction as the totals, so the trend chart can
    // never drift from the numbers it sits beside.
    await recordTimelineBatch(tx, input.artifactType, input.artifactId, input.reactionType, input.quantity, now);

    const isNewOpinion = previousStance === null;

    // The opinion history gets its own bucket, and only on the batch that
    // commits the side — one increment per person for the artifact's lifetime.
    if (isNewOpinion) {
      await recordOpinionCommitment(tx, input.artifactType, input.artifactId, stance, now);
    }

    const totals = await applyTotalsDelta(tx, input.artifactType, input.artifactId, {
      rottenEggs: eggDelta,
      medals: medalDelta,
      positiveOpinions: isNewOpinion && stance === 'positive' ? 1 : 0,
      negativeOpinions: isNewOpinion && stance === 'negative' ? 1 : 0,
      participants: isNewParticipant ? 1 : 0,
      rottenEggContributors: isFirstEgg ? 1 : 0,
      medalContributors: isFirstMedal ? 1 : 0,
    });

    return {
      totals,
      contribution: {
        rottenEggCount: Number(aggregateRows[0]?.rotten_egg_count ?? 0),
        medalCount: Number(aggregateRows[0]?.medal_count ?? 0),
        stance,
      } satisfies UserContribution,
    };
  });

  if (!result || 'locked' in result) {
    const [totals, contribution] = await Promise.all([
      getTotals(input.artifactType, input.artifactId),
      getContribution(input.userId, input.artifactType, input.artifactId),
    ]);
    return {
      applied: false,
      totals,
      contribution,
      stance,
      ...(result && 'locked' in result ? { lockedTo: result.locked } : {}),
    };
  }

  publishArtifactEvent({
    artifactType: input.artifactType,
    artifactId: input.artifactId,
    reactionType: input.reactionType,
    quantity: input.quantity,
    totals: result.totals,
    actorId: input.userId,
  });

  return { applied: true, totals: result.totals, contribution: result.contribution, stance };
}

/**
 * Inserts the batch ledger row, returning false when this client batch id was
 * already recorded for this user. This is what makes retries safe.
 */
async function claimBatch(tx: SqlExecutor, input: ApplyBatchInput, now: string): Promise<boolean> {
  const rows = await tx.query<{ id: string }>(
    `INSERT INTO reaction_batches (id, user_id, artifact_type, artifact_id, reaction_type, quantity, client_batch_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, client_batch_id) DO NOTHING
     RETURNING id`,
    [newId(), input.userId, input.artifactType, input.artifactId, input.reactionType, input.quantity, input.clientBatchId, now],
  );
  return rows.length > 0;
}

/** Confirms an artifact exists and is publicly reactable. */
export async function artifactIsReactable(artifactType: ArtifactType, artifactId: string): Promise<boolean> {
  const table = artifactType === 'entity' ? 'entities' : 'flash_news';
  const row = await queryOne<{ status: string }>(`SELECT status FROM ${table} WHERE id = $1`, [artifactId]);
  return row?.status === 'published';
}

