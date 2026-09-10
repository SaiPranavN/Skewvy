import { getDb } from './index';
import { schemaStatements } from './schema';

/** Applies the schema. Every statement is idempotent, so this is safe to re-run. */
export async function migrate(): Promise<void> {
  const db = await getDb();
  for (const statement of schemaStatements()) {
    await db.execute(statement);
  }
}
