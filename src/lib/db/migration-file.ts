import { SCHEMA_SQL, postgresHardeningSql, storageSetupSql } from './schema';

/**
 * The Supabase migration file, generated from the schema module.
 *
 * Two copies of a schema drift apart, so this one is derived rather than
 * written: `npm run db:generate` rewrites it and a test fails if it is stale.
 * The schema module stays the source of truth; the file exists for the Supabase
 * CLI and the dashboard SQL editor, which cannot import TypeScript.
 */
export const MIGRATION_PATH = 'supabase/migrations/20260913000000_skewvy_init.sql';

export function migrationFileContents(): string {
  return `-- Skewvy — initial schema for Supabase.
--
-- Generated from src/lib/db/schema.ts, which is the source of truth. Do not
-- edit this file by hand; run \`npm run db:generate\` instead.
--
-- Apply with either:
--   npm run db:migrate            (uses DATABASE_URL)
--   supabase db push              (Supabase CLI)
--   or paste into the SQL editor in the Supabase dashboard.

${SCHEMA_SQL}

-- ---------------------------------------------------------------------------
-- Keep these tables out of the public API. See postgresHardeningSql().
-- ---------------------------------------------------------------------------
${postgresHardeningSql()}

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded images. See storageSetupSql().
-- ---------------------------------------------------------------------------
${storageSetupSql()}
`;
}
