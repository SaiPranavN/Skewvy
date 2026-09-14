import { getDb } from './index';
import { schemaStatements, postgresHardeningSql, storageSetupSql } from './schema';

/**
 * Applies the schema. Every statement is idempotent, so this is safe to re-run.
 *
 * On PostgreSQL it also re-applies the row-level security lockdown, which is
 * what keeps Skewvy's tables out of reach of Supabase's public API. That runs
 * every time on purpose: a table added later, or RLS switched off by hand in
 * the dashboard, is corrected by the next migration rather than quietly staying
 * open.
 */
export async function migrate(): Promise<void> {
  const db = await getDb();

  for (const statement of schemaStatements()) {
    await db.execute(statement);
  }

  if (db.dialect === 'postgres') {
    await db.execute(postgresHardeningSql());
    await db.execute(storageSetupSql());
  }
}
