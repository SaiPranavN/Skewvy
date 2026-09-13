import { createSqliteDatabase } from './sqlite';
import { createPostgresDatabase } from './postgres';
import type { Database, SqlExecutor } from './types';

export type { Database, SqlExecutor };

/**
 * A single database handle is reused across hot reloads. Next.js re-evaluates
 * modules on every edit in dev, which would otherwise leak connections.
 */
const globalForDb = globalThis as unknown as { __skewvyDb?: Promise<Database> };

const LOCAL_SQLITE_URL = 'sqlite:./data/skewvy.db';

export function resolveUrl(): string {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) return configured;

  /*
   * A production deployment that quietly fell back to a local SQLite file would
   * come up healthy, serve an empty site and lose every write when the instance
   * recycled. Refusing to start is the kinder failure.
   */
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'DATABASE_URL is not set. Point it at the Supabase connection string ' +
        '(Project Settings → Database → Connection string → URI).',
    );
  }

  return LOCAL_SQLITE_URL;
}

export function isPostgresUrl(url: string): boolean {
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

async function connect(): Promise<Database> {
  const url = resolveUrl();
  if (isPostgresUrl(url)) return createPostgresDatabase(url);

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
