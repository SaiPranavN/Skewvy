import { query, queryOne, execute } from '@/lib/db';
import type { SqlExecutor } from '@/lib/db';
import type { ArtifactTotals, ArtifactType, UserContribution } from '@/lib/domain/types';
import { emptyTotals } from '@/lib/domain/types';

interface TotalsRow {
  artifact_type: string;
  artifact_id: string;
  rotten_egg_total: number;
  medal_total: number;
  positive_opinion_total: number;
  negative_opinion_total: number;
  unique_participant_total: number;
  updated_at: string;
}

export function mapTotals(row: TotalsRow): ArtifactTotals {
  return {
    artifactType: row.artifact_type as ArtifactType,
    artifactId: row.artifact_id,
    rottenEggTotal: Number(row.rotten_egg_total),
    medalTotal: Number(row.medal_total),
    positiveOpinionTotal: Number(row.positive_opinion_total),
    negativeOpinionTotal: Number(row.negative_opinion_total),
    uniqueParticipantTotal: Number(row.unique_participant_total),
    updatedAt: row.updated_at,
  };
}

export async function getTotals(artifactType: ArtifactType, artifactId: string): Promise<ArtifactTotals> {
  const row = await queryOne<TotalsRow>(
    'SELECT * FROM artifact_totals WHERE artifact_type = $1 AND artifact_id = $2',
    [artifactType, artifactId],
  );
  return row ? mapTotals(row) : emptyTotals(artifactType, artifactId);
}

/** One round trip for a whole feed of cards. */
export async function getTotalsFor(
  artifacts: Array<{ type: ArtifactType; id: string }>,
): Promise<Map<string, ArtifactTotals>> {
  const map = new Map<string, ArtifactTotals>();
  if (artifacts.length === 0) return map;

  const placeholders = artifacts.map((_, index) => `$${index + 1}`).join(', ');
  const rows = await query<TotalsRow>(
    `SELECT * FROM artifact_totals WHERE artifact_id IN (${placeholders})`,
    artifacts.map((artifact) => artifact.id),
  );

  for (const row of rows) {
    map.set(`${row.artifact_type}:${row.artifact_id}`, mapTotals(row));
  }
  for (const artifact of artifacts) {
    const key = `${artifact.type}:${artifact.id}`;
    if (!map.has(key)) map.set(key, emptyTotals(artifact.type, artifact.id));
  }
  return map;
}

export interface TotalsDelta {
  rottenEggs?: number;
  medals?: number;
  positiveOpinions?: number;
  negativeOpinions?: number;
  participants?: number;
}

/**
 * Applies signed deltas to the stored totals in a single atomic statement.
 * Client-supplied totals are never written — only deltas the server computed.
 */
export async function applyTotalsDelta(
  tx: SqlExecutor,
  artifactType: ArtifactType,
  artifactId: string,
  delta: TotalsDelta,
): Promise<ArtifactTotals> {
  const rows = await tx.query<TotalsRow>(
    `INSERT INTO artifact_totals (
        artifact_type, artifact_id, rotten_egg_total, medal_total,
        positive_opinion_total, negative_opinion_total, unique_participant_total, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (artifact_type, artifact_id) DO UPDATE SET
       rotten_egg_total = artifact_totals.rotten_egg_total + $3,
       medal_total = artifact_totals.medal_total + $4,
       positive_opinion_total = artifact_totals.positive_opinion_total + $5,
       negative_opinion_total = artifact_totals.negative_opinion_total + $6,
       unique_participant_total = artifact_totals.unique_participant_total + $7,
       updated_at = $8
     RETURNING *`,
    [
      artifactType,
      artifactId,
      delta.rottenEggs ?? 0,
      delta.medals ?? 0,
      delta.positiveOpinions ?? 0,
      delta.negativeOpinions ?? 0,
      delta.participants ?? 0,
      new Date().toISOString(),
    ],
  );

  return mapTotals(rows[0]);
}

export async function getContribution(
  userId: string,
  artifactType: ArtifactType,
  artifactId: string,
): Promise<UserContribution> {
  const aggregate = await queryOne<{ rotten_egg_count: number; medal_count: number }>(
    'SELECT rotten_egg_count, medal_count FROM reaction_aggregates WHERE user_id = $1 AND artifact_type = $2 AND artifact_id = $3',
    [userId, artifactType, artifactId],
  );
  const opinion = await queryOne<{ stance: string }>(
    'SELECT stance FROM opinions WHERE user_id = $1 AND artifact_type = $2 AND artifact_id = $3',
    [userId, artifactType, artifactId],
  );

  return {
    rottenEggCount: Number(aggregate?.rotten_egg_count ?? 0),
    medalCount: Number(aggregate?.medal_count ?? 0),
    stance: (opinion?.stance as 'positive' | 'negative' | undefined) ?? null,
  };
}

export async function getContributionsFor(
  userId: string,
  artifacts: Array<{ type: ArtifactType; id: string }>,
): Promise<Map<string, UserContribution>> {
  const map = new Map<string, UserContribution>();
  if (artifacts.length === 0) return map;

  const ids = artifacts.map((artifact) => artifact.id);
  const placeholders = ids.map((_, index) => `$${index + 2}`).join(', ');

  const aggregates = await query<{ artifact_type: string; artifact_id: string; rotten_egg_count: number; medal_count: number }>(
    `SELECT artifact_type, artifact_id, rotten_egg_count, medal_count FROM reaction_aggregates
      WHERE user_id = $1 AND artifact_id IN (${placeholders})`,
    [userId, ...ids],
  );
  const opinions = await query<{ artifact_type: string; artifact_id: string; stance: string }>(
    `SELECT artifact_type, artifact_id, stance FROM opinions
      WHERE user_id = $1 AND artifact_id IN (${placeholders})`,
    [userId, ...ids],
  );

  for (const artifact of artifacts) {
    map.set(`${artifact.type}:${artifact.id}`, { rottenEggCount: 0, medalCount: 0, stance: null });
  }
  for (const row of aggregates) {
    const key = `${row.artifact_type}:${row.artifact_id}`;
    const current = map.get(key) ?? { rottenEggCount: 0, medalCount: 0, stance: null };
    map.set(key, { ...current, rottenEggCount: Number(row.rotten_egg_count), medalCount: Number(row.medal_count) });
  }
  for (const row of opinions) {
    const key = `${row.artifact_type}:${row.artifact_id}`;
    const current = map.get(key) ?? { rottenEggCount: 0, medalCount: 0, stance: null };
    map.set(key, { ...current, stance: row.stance as 'positive' | 'negative' });
  }

  return map;
}

/**
 * Rebuilds the denormalised totals from the aggregate and opinion tables.
 * Used by the seeder and by the admin "reset demo totals" action.
 */
export async function recomputeTotals(artifactType: ArtifactType, artifactId: string): Promise<ArtifactTotals> {
  const reactions = await queryOne<{ eggs: number | null; medals: number | null; participants: number | null }>(
    `SELECT SUM(rotten_egg_count) AS eggs, SUM(medal_count) AS medals, COUNT(*) AS participants
       FROM reaction_aggregates WHERE artifact_type = $1 AND artifact_id = $2`,
    [artifactType, artifactId],
  );
  const positive = await queryOne<{ count: number }>(
    `SELECT COUNT(*) AS count FROM opinions WHERE artifact_type = $1 AND artifact_id = $2 AND stance = 'positive'`,
    [artifactType, artifactId],
  );
  const negative = await queryOne<{ count: number }>(
    `SELECT COUNT(*) AS count FROM opinions WHERE artifact_type = $1 AND artifact_id = $2 AND stance = 'negative'`,
    [artifactType, artifactId],
  );

  const now = new Date().toISOString();
  const rows = await query<TotalsRow>(
    `INSERT INTO artifact_totals (
        artifact_type, artifact_id, rotten_egg_total, medal_total,
        positive_opinion_total, negative_opinion_total, unique_participant_total, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (artifact_type, artifact_id) DO UPDATE SET
       rotten_egg_total = $3, medal_total = $4,
       positive_opinion_total = $5, negative_opinion_total = $6,
       unique_participant_total = $7, updated_at = $8
     RETURNING *`,
    [
      artifactType,
      artifactId,
      Number(reactions?.eggs ?? 0),
      Number(reactions?.medals ?? 0),
      Number(positive?.count ?? 0),
      Number(negative?.count ?? 0),
      Number(reactions?.participants ?? 0),
      now,
    ],
  );

  return mapTotals(rows[0]);
}

/** Reactions received inside the trailing window — the input to trending velocity. */
export async function recentVelocity(
  windowMinutes = 180,
): Promise<Map<string, { rottenEggs: number; medals: number }>> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const rows = await query<{ artifact_type: string; artifact_id: string; reaction_type: string; total: number }>(
    `SELECT artifact_type, artifact_id, reaction_type, SUM(quantity) AS total
       FROM reaction_batches WHERE created_at >= $1
      GROUP BY artifact_type, artifact_id, reaction_type`,
    [since],
  );

  const map = new Map<string, { rottenEggs: number; medals: number }>();
  for (const row of rows) {
    const key = `${row.artifact_type}:${row.artifact_id}`;
    const current = map.get(key) ?? { rottenEggs: 0, medals: 0 };
    if (row.reaction_type === 'rotten_egg') current.rottenEggs += Number(row.total);
    else current.medals += Number(row.total);
    map.set(key, current);
  }
  return map;
}

/** Trims the batch ledger; it exists for idempotency and velocity, not history. */
export async function pruneReactionBatches(olderThanHours = 48): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();
  await execute('DELETE FROM reaction_batches WHERE created_at < $1', [cutoff]);
}
