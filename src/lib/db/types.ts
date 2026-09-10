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
}
