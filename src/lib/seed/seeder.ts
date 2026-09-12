import { getDb, execute, query } from '@/lib/db';
import type { SqlExecutor } from '@/lib/db';
import { migrate } from '@/lib/db/migrate';
import { newId } from '@/lib/services/crypto';
import { hashPin } from '@/lib/services/pin';
import { SEED_ENTITIES, SEED_FLASH_NEWS } from './data';

/**
 * Builds a believable starting state.
 *
 * Reaction counts are not written straight into `artifact_totals`. The seeder
 * creates real demo participants, gives each of them a reaction aggregate and a
 * single opinion row, then derives the totals from those — so the seeded data
 * obeys exactly the same invariants the live reaction path does.
 */

const DEMO_EMAIL_DOMAIN = 'demo-crowd.skewvy.invalid';
const USER_POOL_SIZE = 9000;

/** Deterministic PRNG so repeated seeds produce the same demo world. */
function createRandom(seed = 20260910): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

/** Chunked multi-row INSERT that stays inside both drivers' parameter limits. */
async function bulkInsert(
  tx: SqlExecutor,
  table: string,
  columns: string[],
  rows: unknown[][],
): Promise<void> {
  if (rows.length === 0) return;
  const maxParams = 700;
  const rowsPerChunk = Math.max(1, Math.floor(maxParams / columns.length));

  for (let start = 0; start < rows.length; start += rowsPerChunk) {
    const chunk = rows.slice(start, start + rowsPerChunk);
    const params: unknown[] = [];
    const valueGroups = chunk.map((row) => {
      const placeholders = row.map((value) => {
        params.push(value);
        return `$${params.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    await tx.execute(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${valueGroups.join(', ')}`,
      params,
    );
  }
}

/**
 * Long-tailed reaction volume: most people tap a handful of times, a few send
 * hundreds. Mean lands near `intensity`.
 */
function reactionQuantity(random: () => number, intensity: number): number {
  const sample = -Math.log(1 - random()) * intensity;
  return Math.min(420, Math.max(1, Math.round(sample)));
}

export interface SeedOptions {
  /** Wipes users, content and counters before seeding. */
  reset?: boolean;
  log?: (message: string) => void;
}

export async function seedDatabase(options: SeedOptions = {}): Promise<{
  entities: number;
  flashNews: number;
  participants: number;
  reactions: number;
}> {
  const log = options.log ?? (() => {});
  await migrate();

  if (options.reset) {
    log('Clearing existing content and counters…');
    for (const table of [
      'reaction_batches',
      'reaction_aggregates',
      'opinions',
      'artifact_totals',
      'flash_news_entities',
      'flash_news',
      'entities',
      'auth_tokens',
      'sessions',
      'rate_limits',
    ]) {
      await execute(`DELETE FROM ${table}`);
    }
    await execute('DELETE FROM users WHERE email_normalized LIKE $1', [`%@${DEMO_EMAIL_DOMAIN}`]);
  }

  const random = createRandom();
  const now = Date.now();
  const db = await getDb();

  /* ------------------------------- content ------------------------------- */

  const entityIdBySlug = new Map<string, string>();
  const flashIdBySlug = new Map<string, string>();

  await db.transaction(async (tx) => {
    const entityRows = SEED_ENTITIES.map((entity) => {
      const id = newId();
      entityIdBySlug.set(entity.slug, id);
      const createdAt = new Date(now - (30 + random() * 300) * 86400000).toISOString();
      return [
        id,
        entity.slug,
        entity.name,
        entity.description,
        entity.category,
        null,
        null,
        'published',
        createdAt,
        new Date(now - random() * 86400000).toISOString(),
      ];
    });

    await bulkInsert(
      tx,
      'entities',
      ['id', 'slug', 'name', 'description', 'category', 'image_url', 'accent', 'status', 'created_at', 'updated_at'],
      entityRows,
    );

    const flashRows = SEED_FLASH_NEWS.map((item) => {
      const id = newId();
      flashIdBySlug.set(item.slug, id);
      const publishedAt = new Date(now - item.hoursAgo * 3600000).toISOString();
      return [
        id,
        item.slug,
        item.headline,
        item.summary,
        item.body,
        item.category,
        null,
        null,
        item.sourceLabel,
        publishedAt,
        'published',
        publishedAt,
        publishedAt,
      ];
    });

    await bulkInsert(
      tx,
      'flash_news',
      [
        'id', 'slug', 'headline', 'summary', 'body', 'category', 'image_url', 'accent',
        'source_label', 'published_at', 'status', 'created_at', 'updated_at',
      ],
      flashRows,
    );

    const joinRows: unknown[][] = [];
    for (const item of SEED_FLASH_NEWS) {
      for (const entitySlug of item.entitySlugs) {
        const entityId = entityIdBySlug.get(entitySlug);
        if (entityId) joinRows.push([flashIdBySlug.get(item.slug), entityId]);
      }
    }
    await bulkInsert(tx, 'flash_news_entities', ['flash_news_id', 'entity_id'], joinRows);
  });

  log(`Inserted ${SEED_ENTITIES.length} Entities and ${SEED_FLASH_NEWS.length} Flash News items.`);

  /* ---------------------------- demo participants ---------------------------- */

  const existingDemoUsers = await query<{ id: string }>(
    'SELECT id FROM users WHERE email_normalized LIKE $1 ORDER BY created_at',
    [`%@${DEMO_EMAIL_DOMAIN}`],
  );
  const userIds = existingDemoUsers.map((row) => row.id);

  if (userIds.length < USER_POOL_SIZE) {
    // One hash reused across demo accounts — they hold no real credential and
    // can never be signed into, and hashing 9,000 PINs would be pointless work.
    const demoHash = await hashPin(`demo-crowd-${newId()}`);
    const createdAt = new Date(now - 200 * 86400000).toISOString();

    await db.transaction(async (tx) => {
      const rows: unknown[][] = [];
      for (let index = userIds.length; index < USER_POOL_SIZE; index += 1) {
        const id = newId();
        userIds.push(id);
        const email = `crowd-${index}@${DEMO_EMAIL_DOMAIN}`;
        rows.push([id, `Crowd member ${index + 1}`, email, email, demoHash, createdAt, createdAt, createdAt]);
      }
      await bulkInsert(
        tx,
        'users',
        ['id', 'display_name', 'email', 'email_normalized', 'pin_hash', 'email_verified_at', 'created_at', 'updated_at'],
        rows,
      );
    });
    log(`Created a demo crowd of ${USER_POOL_SIZE} participants.`);
  }

  /* ------------------------- reactions and opinions ------------------------- */

  const artifacts = [
    ...SEED_ENTITIES.map((entity) => ({
      type: 'entity' as const,
      id: entityIdBySlug.get(entity.slug)!,
      eggBias: entity.eggBias,
      participants: entity.participants,
      intensity: entity.intensity,
      ageHours: 24 * 30,
    })),
    ...SEED_FLASH_NEWS.map((item) => ({
      type: 'flash_news' as const,
      id: flashIdBySlug.get(item.slug)!,
      eggBias: item.eggBias,
      participants: item.participants,
      intensity: item.intensity,
      ageHours: item.hoursAgo,
    })),
  ];

  let totalParticipants = 0;
  let totalReactions = 0;

  for (const artifact of artifacts) {
    const aggregateRows: unknown[][] = [];
    const opinionRows: unknown[][] = [];
    const batchRows: unknown[][] = [];

    const participantCount = Math.min(artifact.participants, userIds.length);
    // A rotating offset so different artifacts draw overlapping but distinct crowds.
    const offset = Math.floor(random() * userIds.length);

    let eggTotal = 0;
    let medalTotal = 0;

    for (let index = 0; index < participantCount; index += 1) {
      const userId = userIds[(offset + index) % userIds.length];
      const negative = random() < artifact.eggBias;
      const quantity = reactionQuantity(random, artifact.intensity);

      // Seeded people obey the same rule as live ones: a side, once taken, is
      // final, so nobody holds reactions on both sides of an artifact.
      const eggs = negative ? quantity : 0;
      const medals = negative ? 0 : quantity;

      eggTotal += eggs;
      medalTotal += medals;

      const createdAt = new Date(now - random() * artifact.ageHours * 3600000).toISOString();
      aggregateRows.push([newId(), userId, artifact.type, artifact.id, eggs, medals, createdAt, createdAt]);
      opinionRows.push([newId(), userId, artifact.type, artifact.id, negative ? 'negative' : 'positive', createdAt, createdAt]);

      // Record a slice of the most recent activity in the batch ledger so the
      // trending velocity numbers are derived from real recorded batches.
      if (batchRows.length < 60 && random() < 0.02) {
        const recentQuantity = Math.max(1, Math.round(quantity * (0.3 + random() * 0.5)));
        batchRows.push([
          newId(),
          userId,
          artifact.type,
          artifact.id,
          negative ? 'rotten_egg' : 'medal',
          recentQuantity,
          `seed-${newId()}`,
          new Date(now - random() * Math.min(artifact.ageHours, 20) * 3600000).toISOString(),
        ]);
      }
    }

    await db.transaction(async (tx) => {
      await bulkInsert(
        tx,
        'reaction_aggregates',
        ['id', 'user_id', 'artifact_type', 'artifact_id', 'rotten_egg_count', 'medal_count', 'created_at', 'updated_at'],
        aggregateRows,
      );
      await bulkInsert(
        tx,
        'opinions',
        ['id', 'user_id', 'artifact_type', 'artifact_id', 'stance', 'created_at', 'updated_at'],
        opinionRows,
      );
      await bulkInsert(
        tx,
        'reaction_batches',
        ['id', 'user_id', 'artifact_type', 'artifact_id', 'reaction_type', 'quantity', 'client_batch_id', 'created_at'],
        batchRows,
      );
    });

    totalParticipants += participantCount;
    totalReactions += eggTotal + medalTotal;
  }

  log('Deriving artifact totals from the seeded aggregates and opinions…');
  await rebuildAllTotals();

  return {
    entities: SEED_ENTITIES.length,
    flashNews: SEED_FLASH_NEWS.length,
    participants: totalParticipants,
    reactions: totalReactions,
  };
}

/** Recomputes every artifact's totals from the underlying rows. */
export async function rebuildAllTotals(): Promise<void> {
  const { recomputeTotals } = await import('@/lib/services/totals');
  const entities = await query<{ id: string }>('SELECT id FROM entities');
  const flashNews = await query<{ id: string }>('SELECT id FROM flash_news');

  for (const row of entities) await recomputeTotals('entity', row.id);
  for (const row of flashNews) await recomputeTotals('flash_news', row.id);
}

/** Admin action: clears all reaction and opinion data, keeps the content. */
export async function resetDemoTotals(): Promise<void> {
  for (const table of ['reaction_batches', 'reaction_aggregates', 'opinions']) {
    await execute(`DELETE FROM ${table}`);
  }
  await execute('DELETE FROM artifact_totals');
  await rebuildAllTotals();
}
