import { createSqliteDatabase } from './sqlite';
import { createPostgresDatabase } from './postgres';
import type { Database, SqlExecutor } from './types';

export type { Database, SqlExecutor };

/**
 * A single database handle is reused across hot reloads. Next.js re-evaluates
 * modules on every edit in dev, which would otherwise leak connections.
 */
const globalForDb = globalThis as unknown as { __skewvyDb?: Promise<Database> };

function resolveUrl(): string {
  return process.env.DATABASE_URL?.trim() || 'sqlite:./data/skewvy.db';
}

async function connect(): Promise<Database> {
  const url = resolveUrl();
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return createPostgresDatabase(url);
  }
  const file = url.replace(/^sqlite:(\/\/)?/, '') || './data/skewvy.db';
  return createSqliteDatabase(file);
}

export function getDb(): Promise<Database> {
  globalForDb.__skewvyDb ??= connect();
  return globalForDb.__skewvyDb;
}

/** Convenience helpers so call sites don't await the handle twice. */
export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return db.query<T>(sql, params);
}

export async function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params: unknown[] = []): Promise<void> {
  const db = await getDb();
  await db.execute(sql, params);
}

export async function transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(fn);
}

/** Test helper: swap in an isolated database handle. */
export function __setDatabaseForTests(db: Promise<Database> | undefined): void {
  globalForDb.__skewvyDb = db;
}
