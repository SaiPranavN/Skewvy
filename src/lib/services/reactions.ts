import { transaction, queryOne } from '@/lib/db';
import type { SqlExecutor } from '@/lib/db';
import { newId } from './crypto';
import { applyTotalsDelta, getTotals, getContribution } from './totals';
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
  /** Simulated crowd activity is written the same way but never broadcast as a personal tap. */
  source?: 'user' | 'simulator';
}

export interface ApplyBatchResult {
  /** False when this exact batch had already been recorded, so a retry is a no-op. */
  applied: boolean;
  totals: ArtifactTotals;
  contribution: UserContribution;
  stance: Stance;
}

/** Opinion transitions expressed as signed deltas on the two opinion counters. */
function opinionDelta(previous: Stance | null, next: Stance): { positive: number; negative: number } {
  if (previous === next) return { positive: 0, negative: 0 };
  const delta = { positive: 0, negative: 0 };
  if (previous === 'positive') delta.positive -= 1;
  if (previous === 'negative') delta.negative -= 1;
  if (next === 'positive') delta.positive += 1;
  else delta.negative += 1;
  return delta;
}

/**
 * Records one batch of taps.
 *
 * Reactions accumulate (a person can send hundreds) while the Opinion is
 * upserted to exactly one row per person per artifact. The two are never mixed:
 * `rotten_egg_total` counts taps, `negative_opinion_total` counts people.
 *
 * The whole thing is idempotent on `(user_id, client_batch_id)`, so a retried
 * request can never double-count.
 */
export async function applyReactionBatch(input: ApplyBatchInput): Promise<ApplyBatchResult> {
  const stance = stanceForReaction(input.reactionType);
  const now = new Date().toISOString();

  const result = await transaction(async (tx) => {
    const claimed = await claimBatch(tx, input, now);
    if (!claimed) {
      // Already processed. Return authoritative state without touching counters.
      return null;
    }

    const existingAggregate = await tx.query<{ id: string }>(
      'SELECT id FROM reaction_aggregates WHERE user_id = $1 AND artifact_type = $2 AND artifact_id = $3',
      [input.userId, input.artifactType, input.artifactId],
    );
    const isNewParticipant = existingAggregate.length === 0;

    const existingOpinion = await tx.query<{ stance: string }>(
      'SELECT stance FROM opinions WHERE user_id = $1 AND artifact_type = $2 AND artifact_id = $3',
      [input.userId, input.artifactType, input.artifactId],
    );
    const previousStance = (existingOpinion[0]?.stance as Stance | undefined) ?? null;

    const eggDelta = input.reactionType === 'rotten_egg' ? input.quantity : 0;
    const medalDelta = input.reactionType === 'medal' ? input.quantity : 0;

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

    // The opinion row is updated in place — never incremented, never duplicated.
    await tx.execute(
      `INSERT INTO opinions (id, user_id, artifact_type, artifact_id, stance, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (user_id, artifact_type, artifact_id) DO UPDATE SET
         stance = $5, updated_at = $6`,
      [newId(), input.userId, input.artifactType, input.artifactId, stance, now],
    );

    const opinionShift = opinionDelta(previousStance, stance);
    const totals = await applyTotalsDelta(tx, input.artifactType, input.artifactId, {
      rottenEggs: eggDelta,
      medals: medalDelta,
      positiveOpinions: opinionShift.positive,
      negativeOpinions: opinionShift.negative,
      participants: isNewParticipant ? 1 : 0,
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

  if (!result) {
    const [totals, contribution] = await Promise.all([
      getTotals(input.artifactType, input.artifactId),
      getContribution(input.userId, input.artifactType, input.artifactId),
    ]);
    return { applied: false, totals, contribution, stance };
  }

  publishArtifactEvent({
    artifactType: input.artifactType,
    artifactId: input.artifactId,
    reactionType: input.reactionType,
    quantity: input.quantity,
    totals: result.totals,
    source: input.source ?? 'user',
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

export interface RecentActivityItem {
  reactionType: ReactionType;
  quantity: number;
  createdAt: string;
}

/** Feeds the "recent reaction activity" strip on the artifact page. */
export async function recentActivity(
  artifactType: ArtifactType,
  artifactId: string,
  limit = 12,
): Promise<RecentActivityItem[]> {
  const rows = await (
    await import('@/lib/db')
  ).query<{ reaction_type: string; quantity: number; created_at: string }>(
    `SELECT reaction_type, quantity, created_at FROM reaction_batches
      WHERE artifact_type = $1 AND artifact_id = $2
      ORDER BY created_at DESC LIMIT $3`,
    [artifactType, artifactId, limit],
  );

  return rows.map((row) => ({
    reactionType: row.reaction_type as ReactionType,
    quantity: Number(row.quantity),
    createdAt: row.created_at,
  }));
}
