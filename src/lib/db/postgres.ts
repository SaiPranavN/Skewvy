import type { Database, SqlExecutor } from './types';

export async function createPostgresDatabase(connectionString: string): Promise<Database> {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString,
    max: 10,
    ssl: /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
  });

  const wrap = (client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }): SqlExecutor => ({
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await client.query(sql, params);
      return result.rows as T[];
    },
    async execute(sql: string, params: unknown[] = []) {
      await client.query(sql, params);
    },
  });

  const root = wrap(pool as never);

  return {
    dialect: 'postgres',
    ...root,
    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(wrap(client as never));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}
