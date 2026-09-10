import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Database, SqlExecutor } from './types';

const require = createRequire(import.meta.url);

/**
 * Rewrites `$1`-style placeholders to the positional `?` form SQLite expects,
 * re-ordering the parameter list to match the order the placeholders appear in.
 */
export function toSqlitePlaceholders(sql: string, params: unknown[]): { sql: string; params: unknown[] } {
  const ordered: unknown[] = [];
  const rewritten = sql.replace(/\$(\d+)/g, (_match, index: string) => {
    ordered.push(params[Number(index) - 1]);
    return '?';
  });
  return { sql: rewritten, params: ordered };
}

/** SQLite stores no native boolean or date types, so normalise before binding. */
function normalise(params: unknown[]): unknown[] {
  return params.map((value) => {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value instanceof Date) return value.toISOString();
    if (value === undefined) return null;
    return value;
  });
}

export function createSqliteDatabase(file: string): Database {
  let sqlite: { DatabaseSync: new (path: string) => SqliteHandle };
  try {
    sqlite = require('node:sqlite');
  } catch {
    throw new Error(
      'node:sqlite is unavailable. Run Node 22.5+ with NODE_OPTIONS=--experimental-sqlite, ' +
        'or point DATABASE_URL at a PostgreSQL instance.',
    );
  }

  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const handle = new sqlite.DatabaseSync(file);
  handle.exec('PRAGMA journal_mode = WAL');
  handle.exec('PRAGMA foreign_keys = ON');
  handle.exec('PRAGMA busy_timeout = 5000');

  const run = <T>(sql: string, params: unknown[] = []): T[] => {
    const prepared = toSqlitePlaceholders(sql, params);
    const statement = handle.prepare(prepared.sql);
    const bound = normalise(prepared.params) as never[];
    // `all()` throws on statements that return nothing in some builds; `run()` is the fallback.
    try {
      return statement.all(...bound) as T[];
    } catch (error) {
      if (error instanceof Error && /does not return data|no result/i.test(error.message)) {
        statement.run(...bound);
        return [];
      }
      throw error;
    }
  };

  const executor: SqlExecutor = {
    async query<T>(sql: string, params: unknown[] = []) {
      return run<T>(sql, params);
    },
    async execute(sql: string, params: unknown[] = []) {
      run(sql, params);
    },
  };

  let depth = 0;

  return {
    dialect: 'sqlite',
    ...executor,
    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      // SQLite has no real nested transactions; savepoints keep nesting safe.
      const nested = depth > 0;
      const savepoint = `sp_${depth}`;
      handle.exec(nested ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE');
      depth += 1;
      try {
        const result = await fn(executor);
        handle.exec(nested ? `RELEASE ${savepoint}` : 'COMMIT');
        return result;
      } catch (error) {
        handle.exec(nested ? `ROLLBACK TO ${savepoint}` : 'ROLLBACK');
        throw error;
      } finally {
        depth -= 1;
      }
    },
    async close() {
      handle.close();
    },
  };
}

interface SqliteHandle {
  exec(sql: string): void;
  prepare(sql: string): { all(...params: never[]): unknown[]; run(...params: never[]): unknown };
  close(): void;
}
