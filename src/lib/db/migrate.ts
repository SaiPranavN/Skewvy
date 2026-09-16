import { getDb } from './index';
import { schemaStatements, postgresHardeningSql, storageSetupSql, ADDED_COLUMNS } from './schema';

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

  // Columns added to tables that already exist elsewhere. Checked rather than
  // attempted, so re-running stays silent instead of throwing.
  for (const { table, column, definition } of ADDED_COLUMNS) {
    const existing =
      db.dialect === 'postgres'
        ? await db.query<{ column_name: string }>(
            'SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
            [table, column],
          )
        : (await db.query<{ name: string }>(`PRAGMA table_info(${table})`)).filter((row) => row.name === column);

    if (existing.length === 0) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  if (db.dialect === 'postgres') {
    await db.execute(postgresHardeningSql());
    await db.execute(storageSetupSql());
  }
}
