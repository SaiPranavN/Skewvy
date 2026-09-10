import { query } from '@/lib/db';
import { listEntities, listFlashNews, toCards } from './content';
import type { ArtifactCard, ArtifactType } from '@/lib/domain/types';

/**
 * Trending ranks by recent reaction velocity rather than lifetime totals, so a
 * new item can outrank an old one that has been quietly accumulating for weeks.
 * Every section states which measurement it uses.
 */

export interface TrendingSection {
  id: string;
  title: string;
  /** Says out loud whether the ranking counts reactions, opinions or people. */
  metricLabel: string;
  description: string;
  cards: ArtifactCard[];
}

const VELOCITY_WINDOW_MINUTES = 24 * 60;

interface VelocityRow {
  artifact_type: string;
  artifact_id: string;
  eggs: number;
  medals: number;
  participants: number;
}

async function velocityRows(windowMinutes = VELOCITY_WINDOW_MINUTES): Promise<VelocityRow[]> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  return query<VelocityRow>(
    `SELECT artifact_type, artifact_id,
            SUM(CASE WHEN reaction_type = 'rotten_egg' THEN quantity ELSE 0 END) AS eggs,
            SUM(CASE WHEN reaction_type = 'medal' THEN quantity ELSE 0 END) AS medals,
            COUNT(DISTINCT user_id) AS participants
       FROM reaction_batches
      WHERE created_at >= $1
      GROUP BY artifact_type, artifact_id`,
    [since],
  );
}

/** Loads the published cards for a set of artifact references, preserving order. */
async function cardsForRefs(
  refs: Array<{ type: ArtifactType; id: string }>,
  viewerId?: string | null,
): Promise<ArtifactCard[]> {
  if (refs.length === 0) return [];

  const entityIds = refs.filter((ref) => ref.type === 'entity').map((ref) => ref.id);
  const flashIds = refs.filter((ref) => ref.type === 'flash_news').map((ref) => ref.id);

  const [entities, flashNews] = await Promise.all([
    entityIds.length
      ? listEntities({ limit: entityIds.length + 10 }).then((all) => all.filter((entity) => entityIds.includes(entity.id)))
      : Promise.resolve([]),
    flashIds.length
      ? listFlashNews({ limit: flashIds.length + 40 }).then((all) => all.filter((item) => flashIds.includes(item.id)))
      : Promise.resolve([]),
  ]);

  const cards = await toCards({ entities, flashNews }, { viewerId, withVelocity: true });
  const order = new Map(refs.map((ref, index) => [`${ref.type}:${ref.id}`, index]));
  return cards.sort((a, b) => (order.get(`${a.type}:${a.id}`) ?? 0) - (order.get(`${b.type}:${b.id}`) ?? 0));
}

export interface TrendingOptions {
  viewerId?: string | null;
  limit?: number;
}

export async function heatIndex(options: TrendingOptions = {}): Promise<ArtifactCard[]> {
  const rows = await velocityRows();
  const ranked = rows
    .map((row) => ({
      type: row.artifact_type as ArtifactType,
      id: row.artifact_id,
      // Total recent reaction volume, regardless of direction: raw crowd energy.
      score: Number(row.eggs) + Number(row.medals) + Number(row.participants) * 25,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 6);

  return cardsForRefs(ranked, options.viewerId);
}

export async function mostRottenEggsToday(options: TrendingOptions = {}): Promise<ArtifactCard[]> {
  const rows = await velocityRows();
  const ranked = rows
    .filter((row) => Number(row.eggs) > 0)
    .sort((a, b) => Number(b.eggs) - Number(a.eggs))
    .slice(0, options.limit ?? 6)
    .map((row) => ({ type: row.artifact_type as ArtifactType, id: row.artifact_id }));
  return cardsForRefs(ranked, options.viewerId);
}

export async function mostMedalsToday(options: TrendingOptions = {}): Promise<ArtifactCard[]> {
  const rows = await velocityRows();
  const ranked = rows
    .filter((row) => Number(row.medals) > 0)
    .sort((a, b) => Number(b.medals) - Number(a.medals))
    .slice(0, options.limit ?? 6)
    .map((row) => ({ type: row.artifact_type as ArtifactType, id: row.artifact_id }));
  return cardsForRefs(ranked, options.viewerId);
}

/**
 * Where the recent mood differs most from the lifetime picture — the crowd
 * switching sides. Compares the recent reaction mix against lifetime totals.
 */
export async function fastestChangingOpinion(options: TrendingOptions = {}): Promise<ArtifactCard[]> {
  const rows = await velocityRows();
  const totals = await query<{ artifact_type: string; artifact_id: string; rotten_egg_total: number; medal_total: number }>(
    'SELECT artifact_type, artifact_id, rotten_egg_total, medal_total FROM artifact_totals',
  );

  const lifetimeShare = new Map<string, number>();
  for (const row of totals) {
    const sum = Number(row.rotten_egg_total) + Number(row.medal_total);
    if (sum > 0) lifetimeShare.set(`${row.artifact_type}:${row.artifact_id}`, Number(row.rotten_egg_total) / sum);
  }

  const ranked = rows
    .map((row) => {
      const recentSum = Number(row.eggs) + Number(row.medals);
      if (recentSum < 100) return null;
      const key = `${row.artifact_type}:${row.artifact_id}`;
      const lifetime = lifetimeShare.get(key);
      if (lifetime === undefined) return null;
      return {
        type: row.artifact_type as ArtifactType,
        id: row.artifact_id,
        swing: Math.abs(Number(row.eggs) / recentSum - lifetime),
      };
    })
    .filter((row): row is { type: ArtifactType; id: string; swing: number } => row !== null)
    .sort((a, b) => b.swing - a.swing)
    .slice(0, options.limit ?? 4);

  return cardsForRefs(ranked, options.viewerId);
}

export async function newlyAdded(options: TrendingOptions = {}): Promise<ArtifactCard[]> {
  const flashNews = await listFlashNews({ limit: options.limit ?? 4 });
  return toCards({ flashNews }, { viewerId: options.viewerId, withVelocity: true });
}

export interface LeaderboardRow {
  card: ArtifactCard;
  primaryCount: number;
  recentChange: number;
}

/** Ranked by reactions received in the trailing window, not lifetime totals. */
export async function leaderboard(
  board: 'heat' | 'medals',
  options: TrendingOptions = {},
): Promise<LeaderboardRow[]> {
  const rows = await velocityRows();
  const key = board === 'heat' ? 'eggs' : 'medals';

  const ranked = rows
    .map((row) => ({
      type: row.artifact_type as ArtifactType,
      id: row.artifact_id,
      recent: Number(row[key]),
    }))
    .sort((a, b) => b.recent - a.recent)
    .slice(0, options.limit ?? 5);

  const cards = await cardsForRefs(ranked, options.viewerId);
  const byKey = new Map(cards.map((card) => [`${card.type}:${card.id}`, card]));

  return ranked
    .map((row) => {
      const card = byKey.get(`${row.type}:${row.id}`);
      if (!card) return null;
      return {
        card,
        primaryCount: board === 'heat' ? card.totals.rottenEggTotal : card.totals.medalTotal,
        recentChange: row.recent,
      };
    })
    .filter((row): row is LeaderboardRow => row !== null);
}

export async function trendingSections(options: TrendingOptions = {}): Promise<TrendingSection[]> {
  const [heat, eggs, medals, swing, fresh] = await Promise.all([
    heatIndex(options),
    mostRottenEggsToday(options),
    mostMedalsToday(options),
    fastestChangingOpinion(options),
    newlyAdded(options),
  ]);

  return [
    {
      id: 'heat-index',
      title: 'The heat index',
      metricLabel: 'Ranked by reactions in the last 24 hours',
      description: 'Raw crowd energy — Rotten Eggs and Medals combined.',
      cards: heat,
    },
    {
      id: 'most-cooked',
      title: 'Most cooked today',
      metricLabel: 'Ranked by Rotten Eggs in the last 24 hours',
      description: 'Where the backlash is landing right now.',
      cards: eggs,
    },
    {
      id: 'medal-worthy',
      title: 'Medal-worthy behaviour',
      metricLabel: 'Ranked by Medals in the last 24 hours',
      description: 'The rare Ws the crowd actually showed up for.',
      cards: medals,
    },
    {
      id: 'switched-sides',
      title: 'The crowd just switched sides',
      metricLabel: 'Ranked by change in reaction mix vs lifetime',
      description: 'Today’s mood disagrees with the record.',
      cards: swing,
    },
    {
      id: 'freshly-on-trial',
      title: 'Freshly on trial',
      metricLabel: 'Newest Flash News, not ranked',
      description: 'Just published. The counters are still warming up.',
      cards: fresh,
    },
  ].filter((section) => section.cards.length > 0);
}
