/** A single SQL execution surface. Both the pool and an open transaction implement it. */
export interface SqlExecutor {
  /** Runs a query written with `$1`-style placeholders and returns typed rows. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs a statement that returns no rows. */
  execute(sql: string, params?: unknown[]): Promise<void>;
}

export interface Database extends SqlExecutor {
  dialect: 'sqlite' | 'postgres';
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  /**
   * Whether the socket this process holds is encrypted.
   *
   * Asking the server (`pg_stat_ssl`) answers the wrong question through a
   * pooler: it describes the pooler's own connection to PostgreSQL, inside
   * Supabase's network, and reports `false` while the hop that actually crosses
   * the internet is fully encrypted. Null until a connection has been made, or
   * on a driver where the question does not apply.
   */
  clientTlsActive?(): boolean | null;
}
