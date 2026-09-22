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
  rotten_egg_contributor_total: number | null;
  medal_contributor_total: number | null;
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
    rottenEggContributorTotal: Number(row.rotten_egg_contributor_total ?? 0),
    medalContributorTotal: Number(row.medal_contributor_total ?? 0),
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

export interface SiteTotals {
  eggs: number;
  medals: number;
  people: number;
}

/**
 * The whole index in three numbers, for the landing page.
 *
 * Reactions sum cleanly across artifacts because every tap belongs to exactly
 * one of them. People do not: the same person taking a side on ten items
 * appears in ten rows, so summing `unique_participant_total` would count them
 * ten times. `opinions` holds one row per person per artifact, so a distinct
 * count over its `user_id` is the only honest answer for "people with a side".
 */
export async function siteTotals(): Promise<SiteTotals> {
  const row = await queryOne<{ eggs: number | null; medals: number | null }>(
    'SELECT SUM(rotten_egg_total) AS eggs, SUM(medal_total) AS medals FROM artifact_totals',
  );

  const people = await queryOne<{ people: number | null }>(
    'SELECT COUNT(DISTINCT user_id) AS people FROM opinions',
  );

  return {
    eggs: Number(row?.eggs ?? 0),
    medals: Number(row?.medals ?? 0),
    people: Number(people?.people ?? 0),
  };
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
  /** 1 only on this person's first Rotten Egg here, never on their hundredth. */
  rottenEggContributors?: number;
  medalContributors?: number;
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
        positive_opinion_total, negative_opinion_total, unique_participant_total,
        rotten_egg_contributor_total, medal_contributor_total, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (artifact_type, artifact_id) DO UPDATE SET
       rotten_egg_total = artifact_totals.rotten_egg_total + $3,
       medal_total = artifact_totals.medal_total + $4,
       positive_opinion_total = artifact_totals.positive_opinion_total + $5,
       negative_opinion_total = artifact_totals.negative_opinion_total + $6,
       unique_participant_total = artifact_totals.unique_participant_total + $7,
       rotten_egg_contributor_total = artifact_totals.rotten_egg_contributor_total + $8,
       medal_contributor_total = artifact_totals.medal_contributor_total + $9,
       updated_at = $10
     RETURNING *`,
    [
      artifactType,
      artifactId,
      delta.rottenEggs ?? 0,
      delta.medals ?? 0,
      delta.positiveOpinions ?? 0,
      delta.negativeOpinions ?? 0,
      delta.participants ?? 0,
      delta.rottenEggContributors ?? 0,
      delta.medalContributors ?? 0,
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
 * Rebuilds the denormalised totals for one artifact from the aggregate and
 * opinion tables, which are the authoritative record.
 *
 * A maintenance operation, not part of the write path: totals are moved by
 * deltas inside the same transaction as the reaction. This is here for the
 * cases where that is not enough — restoring from a backup, correcting a row
 * edited by hand, or verifying the two agree.
 *
 * The contributor counts come from counting aggregate rows with a non-zero
 * count on that side — one row per person — and never from the tap totals,
 * which carry no information about how many people are behind them.
 */
export async function recomputeTotals(artifactType: ArtifactType, artifactId: string): Promise<ArtifactTotals> {
  const reactions = await queryOne<{
    eggs: number | null;
    medals: number | null;
    participants: number | null;
    egg_contributors: number | null;
    medal_contributors: number | null;
  }>(
    `SELECT SUM(rotten_egg_count) AS eggs,
            SUM(medal_count) AS medals,
            COUNT(*) AS participants,
            SUM(CASE WHEN rotten_egg_count > 0 THEN 1 ELSE 0 END) AS egg_contributors,
            SUM(CASE WHEN medal_count > 0 THEN 1 ELSE 0 END) AS medal_contributors
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
        positive_opinion_total, negative_opinion_total, unique_participant_total,
        rotten_egg_contributor_total, medal_contributor_total, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (artifact_type, artifact_id) DO UPDATE SET
       rotten_egg_total = $3, medal_total = $4,
       positive_opinion_total = $5, negative_opinion_total = $6,
       unique_participant_total = $7,
       rotten_egg_contributor_total = $8, medal_contributor_total = $9,
       updated_at = $10
     RETURNING *`,
    [
      artifactType,
      artifactId,
      Number(reactions?.eggs ?? 0),
      Number(reactions?.medals ?? 0),
      Number(positive?.count ?? 0),
      Number(negative?.count ?? 0),
      Number(reactions?.participants ?? 0),
      Number(reactions?.egg_contributors ?? 0),
      Number(reactions?.medal_contributors ?? 0),
      now,
    ],
  );

  return mapTotals(rows[0]);
}

/**
 * Fills the contributor columns for artifacts that predate them.
 *
 * Rows written before these columns existed carry zero, which would read as
 * "100 Rotten Eggs from nobody". Every such row is recomputed from the
 * aggregates, which are the authoritative record and were never lost. An
 * artifact with no reactions at all is skipped: zero is the truth there.
 *
 * Idempotent, and cheap to re-run — it only touches rows that are still empty
 * while holding reactions.
 */
export async function backfillContributorTotals(): Promise<number> {
  const stale = await query<{ artifact_type: string; artifact_id: string }>(
    `SELECT artifact_type, artifact_id FROM artifact_totals
      WHERE rotten_egg_contributor_total = 0
        AND medal_contributor_total = 0
        AND (rotten_egg_total > 0 OR medal_total > 0)`,
  );

  for (const row of stale) {
    await recomputeTotals(row.artifact_type as ArtifactType, row.artifact_id);
  }

  return stale.length;
}

/** Recomputes every artifact's totals. Safe to run at any time; not cheap. */
export async function rebuildAllTotals(): Promise<number> {
  const entities = await query<{ id: string }>('SELECT id FROM entities');
  const flashNews = await query<{ id: string }>('SELECT id FROM flash_news');

  for (const row of entities) await recomputeTotals('entity', row.id);
  for (const row of flashNews) await recomputeTotals('flash_news', row.id);

  return entities.length + flashNews.length;
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
