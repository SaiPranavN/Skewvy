import type { Database, SqlExecutor } from './types';

/**
 * PostgreSQL driver, tuned for Supabase.
 *
 * Skewvy talks to Supabase over plain Postgres rather than through the Supabase
 * client. The data layer, the auth model and the invariants that matter here —
 * one opinion per person, aggregates instead of a row per tap — are all
 * expressed in SQL already, and the server holds a privileged connection, so
 * PostgREST and its anon key add a hop without adding anything.
 */

/** Recognises a Supavisor pooler host, which behaves differently to a direct connection. */
export function isPooledConnection(connectionString: string): boolean {
  return /pooler\.supabase\.com/i.test(connectionString);
}

/** Transaction mode multiplexes one server connection per statement batch. */
export function isTransactionPooler(connectionString: string): boolean {
  return isPooledConnection(connectionString) && /:6543(\/|\?|$)/.test(connectionString);
}

function hostOf(connectionString: string): string {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return '';
  }
}

/**
 * Removes `sslmode` from the connection string, having already read it.
 *
 * `pg` treats `sslmode=require` in a URL as `verify-full` — stricter than libpq,
 * and strict enough to reject Supabase, whose certificate is signed by its own
 * CA. Worse, it silently overrides the explicit `ssl` option, so a connection
 * string copied from the dashboard with `?sslmode=require` appended fails with
 * "self-signed certificate in certificate chain" no matter what the code asks
 * for. TLS is decided here, in one place, and the parameter is taken out of the
 * string so it cannot contradict that.
 */
export function withoutSslMode(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    if (!url.searchParams.has('sslmode')) return connectionString;
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return connectionString;
  }
}

/**
 * TLS is required for anything that is not a local socket.
 *
 * Supabase presents a certificate signed by its own CA. Verifying it properly
 * needs that CA on disk, so `DATABASE_CA_CERT` turns on full verification when
 * the certificate is supplied and the connection stays encrypted-but-unverified
 * when it is not. That is the same posture every Supabase client library ships
 * with by default, and it is called out here rather than left implicit.
 */
export function resolveSsl(connectionString: string): false | { rejectUnauthorized: boolean; ca?: string } {
  const host = hostOf(connectionString);
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '';

  if (isLocal && !/sslmode=require/.test(connectionString)) return false;
  if (/sslmode=disable/.test(connectionString)) return false;

  const ca = process.env.DATABASE_CA_CERT?.trim();
  if (ca) return { rejectUnauthorized: true, ca: ca.replace(/\\n/g, '\n') };

  return { rejectUnauthorized: false };
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function createPostgresDatabase(connectionString: string): Promise<Database> {
  const { Pool } = await import('pg');

  /*
   * Supabase counts every pooler client against the project's connection
   * budget, and a Next.js deployment can run many instances at once. A small
   * per-instance pool that recycles idle clients quickly is the arrangement
   * that survives a traffic spike; a large one exhausts the budget and starts
   * refusing connections for the whole project.
   */
  const pool = new Pool({
    connectionString: withoutSslMode(connectionString),
    application_name: 'skewvy',
    max: positiveInt(process.env.DATABASE_POOL_MAX, isPooledConnection(connectionString) ? 6 : 10),
    idleTimeoutMillis: positiveInt(process.env.DATABASE_IDLE_TIMEOUT_MS, 15_000),
    connectionTimeoutMillis: positiveInt(process.env.DATABASE_CONNECT_TIMEOUT_MS, 10_000),
    // A query that has run this long is not going to finish usefully, and it is
    // holding a pooled connection while it fails to.
    statement_timeout: positiveInt(process.env.DATABASE_STATEMENT_TIMEOUT_MS, 15_000),
    keepAlive: true,
    ssl: resolveSsl(connectionString),
  });

  /*
   * Without this, a client dropped while idle — a pooler recycling it, a
   * network blip — raises an unhandled 'error' event and takes the whole Node
   * process down. The pool discards the client on its own; all this has to do
   * is make sure someone is listening.
   */
  pool.on('error', (error) => {
    console.error('[db] idle client error:', error.message);
  });

  const wrap = (client: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  }): SqlExecutor => ({
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await client.query(sql, params);
      return result.rows as T[];
    },
    async execute(sql: string, params: unknown[] = []) {
      await client.query(sql, params);
    },
  });

  return {
    dialect: 'postgres',
    ...wrap(pool as never),

    /*
     * A transaction has to run every statement on the same client. Taking one
     * out of the pool is what guarantees that — going through the pool itself
     * would let BEGIN and COMMIT land on different connections, which under a
     * transaction-mode pooler is not a theoretical risk.
     */
    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(wrap(client as never));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        // A rollback can itself fail if the connection is already gone; the
        // original error is the one worth reporting.
        await client.query('ROLLBACK').catch(() => {});
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
