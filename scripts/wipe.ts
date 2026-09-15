import { getDb, execute, query, resolveUrl } from '@/lib/db';
import { migrate } from '@/lib/db/migrate';

/**
 * Deletes data. Nothing here generates any.
 *
 * Skewvy ships with no sample content and no simulated crowd, so this exists
 * for the one job that remains: clearing what a real deployment has
 * accumulated. It is destructive and irreversible, so it names the target and
 * refuses to run without --yes.
 *
 *   npm run db:wipe -- --reactions --yes   reactions, opinions and comments
 *   npm run db:wipe -- --content --yes     the above plus Entities and Flash News
 *   npm run db:wipe -- --all --yes         the above plus every account
 */

const args = process.argv.slice(2);
const confirmed = args.includes('--yes');

const scope = args.includes('--all')
  ? 'all'
  : args.includes('--content')
    ? 'content'
    : args.includes('--reactions')
      ? 'reactions'
      : null;

if (!scope) {
  console.error('Choose a scope: --reactions, --content or --all. Add --yes to confirm.');
  process.exit(1);
}

/** Ordered so a child table never outlives the row it references. */
const REACTION_TABLES = [
  'comment_votes',
  'comments',
  'reaction_timeline',
  'reaction_batches',
  'reaction_aggregates',
  'opinions',
  'artifact_totals',
];
const CONTENT_TABLES = ['flash_news_entities', 'flash_news', 'entities'];
const ACCOUNT_TABLES = ['auth_tokens', 'pending_registrations', 'sessions', 'rate_limits', 'app_settings', 'users'];

const tables = [
  ...REACTION_TABLES,
  ...(scope === 'content' || scope === 'all' ? CONTENT_TABLES : []),
  ...(scope === 'all' ? ACCOUNT_TABLES : []),
];

const url = resolveUrl();
const redacted = url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:••••••@');

console.info(`\n🗑️  About to delete from ${tables.length} tables on:\n   ${redacted}\n`);

if (!confirmed) {
  console.error('Refusing to run without --yes.');
  process.exit(1);
}

await migrate();

const db = await getDb();
let removed = 0;

for (const table of tables) {
  const before = await query<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);
  const rows = Number(before[0]?.count ?? 0);
  if (rows > 0) {
    await execute(`DELETE FROM ${table}`);
    console.info(`   ${table.padEnd(22)} ${rows.toLocaleString()} deleted`);
    removed += rows;
  }
}

console.info(`\n✅ ${removed.toLocaleString()} rows deleted.\n`);
await db.close();
