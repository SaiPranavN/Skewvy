import { transaction } from '@/lib/db';
import { newId } from './crypto';
import { applyTotalsDelta, getContribution, getTotals } from './totals';
import { recordOpinionSwitch } from './timeline';
import { publishArtifactEvent } from './realtime';
import { canChangeSide } from '@/lib/domain/types';
import type { ArtifactTotals, ArtifactType, Stance, UserContribution } from '@/lib/domain/types';

export type SwitchOutcome =
  | { status: 'switched' | 'unchanged'; totals: ArtifactTotals; contribution: UserContribution }
  /** This artifact type holds people to the first side they took. */
  | { status: 'final' }
  /** There is no side to change yet — the first reaction is what takes one. */
  | { status: 'no_opinion' };

/**
 * Moves one person's recorded side on an Entity.
 *
 * Only the opinion moves. Every Medal and Rotten Egg this person has already
 * sent stays exactly where it is — in the public totals and in their own
 * contribution — because those reactions happened and the record of them is
 * not theirs to withdraw. What changes is which side they count on from now
 * on, and so which reaction they may send next.
 *
 * The head counts move by one in each direction; the participant count and
 * both contributor counts do not, since the same person is still here and
 * still contributed what they contributed. The change is written to
 * `opinion_changes` so the opinion history can always be rebuilt as it
 * happened.
 */
export async function switchOpinion(input: {
  userId: string;
  artifactType: ArtifactType;
  artifactId: string;
  stance: Stance;
}): Promise<SwitchOutcome> {
  if (!canChangeSide(input.artifactType)) return { status: 'final' };

  const now = new Date().toISOString();

  const outcome = await transaction(async (tx) => {
    const existing = await tx.query<{ stance: string }>(
      'SELECT stance FROM opinions WHERE user_id = $1 AND artifact_type = $2 AND artifact_id = $3',
      [input.userId, input.artifactType, input.artifactId],
    );
    const current = (existing[0]?.stance as Stance | undefined) ?? null;

    if (current === null) return { status: 'no_opinion' } as const;
    if (current === input.stance) return { status: 'unchanged' } as const;

    await tx.execute(
      `UPDATE opinions SET stance = $4, updated_at = $5
        WHERE user_id = $1 AND artifact_type = $2 AND artifact_id = $3`,
      [input.userId, input.artifactType, input.artifactId, input.stance, now],
    );

    await tx.execute(
      `INSERT INTO opinion_changes (id, user_id, artifact_type, artifact_id, from_stance, to_stance, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [newId(), input.userId, input.artifactType, input.artifactId, current, input.stance, now],
    );

    await recordOpinionSwitch(tx, input.artifactType, input.artifactId, input.stance, now);

    const toPositive = input.stance === 'positive';
    const totals = await applyTotalsDelta(tx, input.artifactType, input.artifactId, {
      positiveOpinions: toPositive ? 1 : -1,
      negativeOpinions: toPositive ? -1 : 1,
    });

    return { status: 'switched', totals } as const;
  });

  if (outcome.status === 'no_opinion') return outcome;

  const [totals, contribution] = await Promise.all([
    outcome.status === 'switched' ? Promise.resolve(outcome.totals) : getTotals(input.artifactType, input.artifactId),
    getContribution(input.userId, input.artifactType, input.artifactId),
  ]);

  if (outcome.status === 'switched') {
    // No taps moved, but every open page should see the head counts change.
    publishArtifactEvent({
      artifactType: input.artifactType,
      artifactId: input.artifactId,
      reactionType: input.stance === 'positive' ? 'medal' : 'rotten_egg',
      quantity: 0,
      totals,
      actorId: input.userId,
    });
  }

  return { status: outcome.status, totals, contribution };
}

