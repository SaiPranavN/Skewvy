import { query, queryOne, execute, transaction } from '@/lib/db';
import { newId } from './crypto';
import { getTotalsFor, getContributionsFor, recentVelocity } from './totals';
import type {
  ArtifactCard,
  ArtifactType,
  ContentStatus,
  Entity,
  FlashNews,
} from '@/lib/domain/types';
import type { EntityInput, FlashNewsInput } from '@/lib/validation/schemas';
import { parseDetails, serializeDetails } from '@/lib/domain/details';

interface EntityRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  image_url: string | null;
  accent: string | null;
  details: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface FlashNewsRow {
  id: string;
  slug: string;
  headline: string;
  summary: string;
  body: string;
  category: string;
  image_url: string | null;
  accent: string | null;
  source_label: string | null;
  source_url: string | null;
  details: string | null;
  published_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

function mapEntity(row: EntityRow): Entity {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    imageUrl: row.image_url,
    accent: row.accent,
    details: parseDetails(row.details),
    status: row.status as ContentStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFlashNews(row: FlashNewsRow): FlashNews {
  return {
    id: row.id,
    slug: row.slug,
    headline: row.headline,
    summary: row.summary,
    body: row.body,
    category: row.category,
    imageUrl: row.image_url,
    accent: row.accent,
    sourceLabel: row.source_label,
    sourceUrl: row.source_url,
    details: parseDetails(row.details),
    publishedAt: row.published_at,
    status: row.status as ContentStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ListOptions {
  category?: string | null;
  search?: string | null;
  status?: ContentStatus | 'any';
  limit?: number;
  offset?: number;
  viewerId?: string | null;
}

export async function listEntities(options: ListOptions = {}): Promise<Entity[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (!options.status || options.status !== 'any') {
    params.push(options.status ?? 'published');
    conditions.push(`status = $${params.length}`);
  }
  if (options.category) {
    params.push(options.category);
    conditions.push(`category = $${params.length}`);
  }
  if (options.search) {
    params.push(`%${options.search.toLowerCase()}%`);
    conditions.push(`(LOWER(name) LIKE $${params.length} OR LOWER(description) LIKE $${params.length})`);
  }

  params.push(options.limit ?? 60);
  const limitIndex = params.length;
  params.push(options.offset ?? 0);

  const rows = await query<EntityRow>(
    `SELECT * FROM entities
     ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY name ASC
     LIMIT $${limitIndex} OFFSET $${params.length}`,
    params,
  );
  return rows.map(mapEntity);
}

export interface FlashNewsListOptions extends ListOptions {
  entityId?: string | null;
  order?: 'recent' | 'oldest';
}

export async function listFlashNews(options: FlashNewsListOptions = {}): Promise<FlashNews[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (!options.status || options.status !== 'any') {
    params.push(options.status ?? 'published');
    conditions.push(`f.status = $${params.length}`);
  }
  if (options.category) {
    params.push(options.category);
    conditions.push(`f.category = $${params.length}`);
  }
  if (options.search) {
    params.push(`%${options.search.toLowerCase()}%`);
    conditions.push(`(LOWER(f.headline) LIKE $${params.length} OR LOWER(f.summary) LIKE $${params.length})`);
  }
  if (options.entityId) {
    params.push(options.entityId);
    conditions.push(`EXISTS (SELECT 1 FROM flash_news_entities j WHERE j.flash_news_id = f.id AND j.entity_id = $${params.length})`);
  }

  params.push(options.limit ?? 40);
  const limitIndex = params.length;
  params.push(options.offset ?? 0);

  const rows = await query<FlashNewsRow>(
    `SELECT f.* FROM flash_news f
     ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY COALESCE(f.published_at, f.created_at) ${options.order === 'oldest' ? 'ASC' : 'DESC'}
     LIMIT $${limitIndex} OFFSET $${params.length}`,
    params,
  );
  return rows.map(mapFlashNews);
}

export async function getEntityBySlug(slug: string, includeUnpublished = false): Promise<Entity | null> {
  const row = await queryOne<EntityRow>(
    `SELECT * FROM entities WHERE slug = $1 ${includeUnpublished ? '' : "AND status = 'published'"}`,
    [slug],
  );
  return row ? mapEntity(row) : null;
}

export async function getEntityById(id: string): Promise<Entity | null> {
  const row = await queryOne<EntityRow>('SELECT * FROM entities WHERE id = $1', [id]);
  return row ? mapEntity(row) : null;
}

export async function getFlashNewsBySlug(slug: string, includeUnpublished = false): Promise<FlashNews | null> {
  const row = await queryOne<FlashNewsRow>(
    `SELECT * FROM flash_news WHERE slug = $1 ${includeUnpublished ? '' : "AND status = 'published'"}`,
    [slug],
  );
  return row ? mapFlashNews(row) : null;
}

export async function getFlashNewsById(id: string): Promise<FlashNews | null> {
  const row = await queryOne<FlashNewsRow>('SELECT * FROM flash_news WHERE id = $1', [id]);
  return row ? mapFlashNews(row) : null;
}

export async function entitiesForFlashNews(flashNewsId: string): Promise<Entity[]> {
  const rows = await query<EntityRow>(
    `SELECT e.* FROM entities e
       JOIN flash_news_entities j ON j.entity_id = e.id
      WHERE j.flash_news_id = $1 AND e.status = 'published'
      ORDER BY e.name`,
    [flashNewsId],
  );
  return rows.map(mapEntity);
}

/** Bulk variant so a feed does not run one query per card. */
export async function entitiesForFlashNewsBulk(ids: string[]): Promise<Map<string, Entity[]>> {
  const map = new Map<string, Entity[]>();
  if (ids.length === 0) return map;

  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  const rows = await query<EntityRow & { flash_news_id: string }>(
    `SELECT e.*, j.flash_news_id FROM entities e
       JOIN flash_news_entities j ON j.entity_id = e.id
      WHERE j.flash_news_id IN (${placeholders}) AND e.status = 'published'
      ORDER BY e.name`,
    ids,
  );

  for (const row of rows) {
    const list = map.get(row.flash_news_id) ?? [];
    list.push(mapEntity(row));
    map.set(row.flash_news_id, list);
  }
  return map;
}

export async function flashNewsCountsForEntities(ids: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;

  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
  const rows = await query<{ entity_id: string; count: number }>(
    `SELECT j.entity_id, COUNT(*) AS count FROM flash_news_entities j
       JOIN flash_news f ON f.id = j.flash_news_id AND f.status = 'published'
      WHERE j.entity_id IN (${placeholders})
      GROUP BY j.entity_id`,
    ids,
  );
  for (const row of rows) map.set(row.entity_id, Number(row.count));
  return map;
}

/**
 * Turns raw content rows into the card shape every surface renders, attaching
 * totals, the viewer's own contribution and recent velocity in bulk.
 */
export async function toCards(
  input: { entities?: Entity[]; flashNews?: FlashNews[] },
  options: { viewerId?: string | null; withVelocity?: boolean; withRelations?: boolean } = {},
): Promise<ArtifactCard[]> {
  const entities = input.entities ?? [];
  const flashNews = input.flashNews ?? [];

  const refs = [
    ...entities.map((entity) => ({ type: 'entity' as ArtifactType, id: entity.id })),
    ...flashNews.map((item) => ({ type: 'flash_news' as ArtifactType, id: item.id })),
  ];

  const [totals, contributions, velocity, relatedEntities, relatedCounts] = await Promise.all([
    getTotalsFor(refs),
    options.viewerId ? getContributionsFor(options.viewerId, refs) : Promise.resolve(null),
    options.withVelocity ? recentVelocity() : Promise.resolve(null),
    options.withRelations !== false && flashNews.length
      ? entitiesForFlashNewsBulk(flashNews.map((item) => item.id))
      : Promise.resolve(new Map<string, Entity[]>()),
    options.withRelations !== false && entities.length
      ? flashNewsCountsForEntities(entities.map((entity) => entity.id))
      : Promise.resolve(new Map<string, number>()),
  ]);

  const cards: ArtifactCard[] = [];

  for (const entity of entities) {
    const key = `entity:${entity.id}`;
    cards.push({
      type: 'entity',
      id: entity.id,
      slug: entity.slug,
      title: entity.name,
      subtitle: entity.description,
      category: entity.category,
      imageUrl: entity.imageUrl,
      publishedAt: entity.updatedAt,
      details: entity.details,
      totals: totals.get(key)!,
      contribution: contributions?.get(key) ?? null,
      relatedFlashNewsCount: relatedCounts.get(entity.id) ?? 0,
      recentRottenEggs: velocity?.get(key)?.rottenEggs ?? 0,
      recentMedals: velocity?.get(key)?.medals ?? 0,
    });
  }

  for (const item of flashNews) {
    const key = `flash_news:${item.id}`;
    cards.push({
      type: 'flash_news',
      id: item.id,
      slug: item.slug,
      title: item.headline,
      subtitle: item.summary,
      category: item.category,
      imageUrl: item.imageUrl,
      details: item.details,
      sourceLabel: item.sourceLabel,
      publishedAt: item.publishedAt,
      totals: totals.get(key)!,
      contribution: contributions?.get(key) ?? null,
      relatedEntities: (relatedEntities.get(item.id) ?? []).map((entity) => ({
        id: entity.id,
        slug: entity.slug,
        name: entity.name,
      })),
      recentRottenEggs: velocity?.get(key)?.rottenEggs ?? 0,
      recentMedals: velocity?.get(key)?.medals ?? 0,
    });
  }

  return cards;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

/* ---------------------------------- admin --------------------------------- */

export async function createEntity(input: EntityInput): Promise<Entity> {
  const now = new Date().toISOString();
  const id = newId();
  await execute(
    `INSERT INTO entities (id, slug, name, description, category, image_url, accent, details, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
    [
      id,
      input.slug,
      input.name,
      input.description ?? '',
      input.category,
      input.imageUrl || null,
      input.accent || null,
      serializeDetails(input.details ?? []),
      input.status ?? 'draft',
      now,
    ],
  );
  return (await getEntityById(id))!;
}

export async function updateEntity(id: string, input: EntityInput): Promise<Entity | null> {
  const now = new Date().toISOString();
  await execute(
    `UPDATE entities SET slug = $1, name = $2, description = $3, category = $4,
            image_url = $5, accent = $6, status = $7, updated_at = $8, details = $10 WHERE id = $9`,
    [
      input.slug,
      input.name,
      input.description ?? '',
      input.category,
      input.imageUrl || null,
      input.accent || null,
      input.status ?? 'draft',
      now,
      id,
      serializeDetails(input.details ?? []),
    ],
  );
  return getEntityById(id);
}

export async function setEntityStatus(id: string, status: ContentStatus): Promise<void> {
  await execute('UPDATE entities SET status = $1, updated_at = $2 WHERE id = $3', [status, new Date().toISOString(), id]);
}

export async function createFlashNews(input: FlashNewsInput): Promise<FlashNews> {
  const now = new Date().toISOString();
  const id = newId();

  await transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO flash_news (id, slug, headline, summary, body, category, image_url, accent,
              source_label, source_url, published_at, status, created_at, updated_at, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, $14)`,
      [
        id,
        input.slug,
        input.headline,
        input.summary ?? '',
        input.body ?? '',
        input.category,
        input.imageUrl || null,
        input.accent || null,
        input.sourceLabel || null,
        input.sourceUrl || null,
        input.status === 'published' ? now : null,
        input.status ?? 'draft',
        now,
        serializeDetails(input.details ?? []),
      ],
    );
    for (const entityId of input.entityIds ?? []) {
      await tx.execute('INSERT INTO flash_news_entities (flash_news_id, entity_id) VALUES ($1, $2)', [id, entityId]);
    }
  });

  return (await getFlashNewsById(id))!;
}

export async function updateFlashNews(id: string, input: FlashNewsInput): Promise<FlashNews | null> {
  const now = new Date().toISOString();
  const existing = await getFlashNewsById(id);
  if (!existing) return null;

  // Publishing for the first time stamps published_at; re-publishing keeps it.
  const publishedAt = input.status === 'published' ? existing.publishedAt ?? now : existing.publishedAt;

  await transaction(async (tx) => {
    await tx.execute(
      `UPDATE flash_news SET slug = $1, headline = $2, summary = $3, body = $4, category = $5,
              image_url = $6, accent = $7, source_label = $8, source_url = $9,
              published_at = $10, status = $11, updated_at = $12, details = $14 WHERE id = $13`,
      [
        input.slug,
        input.headline,
        input.summary ?? '',
        input.body ?? '',
        input.category,
        input.imageUrl || null,
        input.accent || null,
        input.sourceLabel || null,
        input.sourceUrl || null,
        publishedAt,
        input.status ?? 'draft',
        now,
        id,
        serializeDetails(input.details ?? []),
      ],
    );
    await tx.execute('DELETE FROM flash_news_entities WHERE flash_news_id = $1', [id]);
    for (const entityId of input.entityIds ?? []) {
      await tx.execute('INSERT INTO flash_news_entities (flash_news_id, entity_id) VALUES ($1, $2)', [id, entityId]);
    }
  });

  return getFlashNewsById(id);
}

export async function setFlashNewsStatus(id: string, status: ContentStatus): Promise<void> {
  const now = new Date().toISOString();
  const existing = await getFlashNewsById(id);
  const publishedAt = status === 'published' ? existing?.publishedAt ?? now : existing?.publishedAt ?? null;
  await execute('UPDATE flash_news SET status = $1, published_at = $2, updated_at = $3 WHERE id = $4', [
    status,
    publishedAt,
    now,
    id,
  ]);
}

export async function entityIdsForFlashNews(flashNewsId: string): Promise<string[]> {
  const rows = await query<{ entity_id: string }>('SELECT entity_id FROM flash_news_entities WHERE flash_news_id = $1', [
    flashNewsId,
  ]);
  return rows.map((row) => row.entity_id);
}

export async function slugExists(table: 'entities' | 'flash_news', slug: string, excludeId?: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(`SELECT id FROM ${table} WHERE slug = $1`, [slug]);
  return Boolean(row && row.id !== excludeId);
}

/**
 * Removes a Profile or Story and everything recorded against it, for good.
 *
 * Nothing that points at an artifact does so through a foreign key — reactions,
 * opinions, history and comments all name it by type and id — so each table is
 * cleared here, inside one transaction, before the row itself goes. Either all
 * of it disappears or none of it does. Comment votes and reports go with their
 * comments by cascade, and a Story's links to its Profiles by cascade too.
 *
 * People keep their accounts; they simply lose this item from their history.
 */
export async function deleteArtifactPermanently(
  artifactType: ArtifactType,
  artifactId: string,
): Promise<{ deleted: boolean; slug: string | null }> {
  const table = artifactType === 'entity' ? 'entities' : 'flash_news';

  return transaction(async (tx) => {
    const found = await tx.query<{ slug: string }>(`SELECT slug FROM ${table} WHERE id = $1`, [artifactId]);
    if (found.length === 0) return { deleted: false, slug: null };

    for (const dependent of [
      'comments',
      'opinion_changes',
      'opinions',
      'reaction_aggregates',
      'reaction_batches',
      'reaction_timeline',
      'opinion_timeline',
      'artifact_totals',
    ]) {
      await tx.execute(`DELETE FROM ${dependent} WHERE artifact_type = $1 AND artifact_id = $2`, [
        artifactType,
        artifactId,
      ]);
    }

    await tx.execute(
      artifactType === 'entity'
        ? 'DELETE FROM flash_news_entities WHERE entity_id = $1'
        : 'DELETE FROM flash_news_entities WHERE flash_news_id = $1',
      [artifactId],
    );
    await tx.execute(`DELETE FROM ${table} WHERE id = $1`, [artifactId]);

    return { deleted: true, slug: found[0].slug };
  });
}
