import { getDb, query, queryOne, resolveUrl, isPostgresUrl } from '@/lib/db';
import { isPooledConnection, isTransactionPooler } from '@/lib/db/postgres';
import { schemaTables } from '@/lib/db/schema';

/**
 * Checks that the configured database is reachable, correctly shaped and — on
 * Supabase — not exposed through the public API.
 *
 * Run it after pointing DATABASE_URL at a new project, and any time the site
 * behaves as though it is talking to the wrong database.
 */

const url = resolveUrl();
const redacted = url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:••••••@');

console.info(`\n🔌 ${redacted}\n`);

const started = Date.now();
let db;
try {
  db = await getDb();
  await db.query('SELECT 1');
} catch (error) {
  console.error(`❌ Could not connect: ${(error as Error).message}\n`);
  console.error(hintFor(error as Error));
  process.exit(1);
}

console.info(`✅ Connected in ${Date.now() - started}ms (${db.dialect}).`);

if (isPostgresUrl(url)) {
  const server = await queryOne<{ version: string; db: string; usr: string }>(
    `SELECT version() AS version, current_database() AS db, current_user AS usr`,
  );
  console.info(`   ${server?.version?.split(' on ')[0] ?? 'unknown version'}`);

  /*
   * Read from our own socket, not from pg_stat_ssl. Through a pooler the server
   * describes the pooler's connection to PostgreSQL — inside Supabase's
   * network, unencrypted, and none of our business. The hop that crosses the
   * internet is this one.
   */
  const tls = db.clientTlsActive?.() ?? null;
  const pooled = isPooledConnection(url);
  console.info(
    `   database ${server?.db}, role ${server?.usr}, TLS ${tls === null ? 'unknown' : tls ? 'on' : 'OFF'}` +
      (pooled ? ' (via the connection pooler)' : ''),
  );
  if (tls === false) {
    console.warn('   ⚠️  This connection is not encrypted. Remove sslmode=disable from DATABASE_URL.');
  }
}

/* ------------------------------- schema ---------------------------------- */

const expected = schemaTables();
const present = new Set(
  isPostgresUrl(url)
    ? (await query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)).map(
        (row) => row.tablename,
      )
    : (await query<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table'`)).map((row) => row.name),
);

const missing = expected.filter((table) => !present.has(table));
console.info(`\n📋 Tables: ${expected.length - missing.length}/${expected.length} present.`);
if (missing.length > 0) {
  console.warn(`   ⚠️  Missing: ${missing.join(', ')}`);
  console.warn('   Run: npm run db:migrate');
}

/* --------------------------- exposure check ------------------------------- */

if (isPostgresUrl(url)) {
  const supabase = await queryOne<{ present: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AS present`,
  );

  if (supabase?.present) {
    /*
     * The publishable key reaches PostgREST as the `anon` role. A Skewvy table
     * it can read is a table the whole internet can read, so this is the check
     * that matters most on a Supabase project.
     */
    const open = await query<{ tablename: string; rls: boolean; grants: number }>(
      `SELECT c.relname AS tablename,
              c.relrowsecurity AS rls,
              (SELECT COUNT(*) FROM information_schema.role_table_grants g
                WHERE g.table_schema = 'public' AND g.table_name = c.relname
                  AND g.grantee IN ('anon', 'authenticated')) AS grants
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1)`,
      [expected],
    );

    const exposed = open.filter((row) => !row.rls || Number(row.grants) > 0);
    if (exposed.length === 0) {
      console.info('\n🔒 Supabase API exposure: every Skewvy table has RLS on and no anon grants.');
    } else {
      console.error('\n🚨 Supabase API exposure: these tables are reachable with the publishable key:');
      for (const row of exposed) {
        console.error(`   ${row.tablename} — RLS ${row.rls ? 'on' : 'OFF'}, ${row.grants} anon/authenticated grant(s)`);
      }
      console.error('   Run: npm run db:migrate');
    }
  }
}

if (isTransactionPooler(url) && process.env.REALTIME_PG_NOTIFY === '1' && !process.env.REALTIME_DATABASE_URL?.trim()) {
  console.warn(
    '\n⚠️  REALTIME_PG_NOTIFY is on with a transaction-mode pooler, which cannot hold a LISTEN.\n' +
      '   Set REALTIME_DATABASE_URL to the session pooler (port 5432).',
  );
}

/* -------------------------------- content --------------------------------- */

if (missing.length === 0) {
  const counts = await queryOne<Record<string, number>>(
    `SELECT (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM entities) AS entities,
            (SELECT COUNT(*) FROM flash_news) AS flash_news,
            (SELECT COUNT(*) FROM opinions) AS opinions,
            (SELECT COUNT(*) FROM reaction_aggregates) AS reaction_aggregates,
            (SELECT COUNT(*) FROM comments) AS comments`,
  );

  console.info('\n📊 Rows:');
  for (const [table, value] of Object.entries(counts ?? {})) {
    console.info(`   ${table.padEnd(20)} ${Number(value).toLocaleString()}`);
  }

  /*
   * An image written to public/uploads exists only on the machine that uploaded
   * it — the directory is gitignored, so it is never deployed and the live site
   * shows a broken image while the row looks perfectly fine.
   */
  const localImages = await query<{ image_url: string }>(
    `SELECT image_url FROM entities WHERE image_url LIKE '/uploads/%'
     UNION ALL
     SELECT image_url FROM flash_news WHERE image_url LIKE '/uploads/%'`,
  );
  if (localImages.length > 0) {
    console.warn(`\n🖼️  ${localImages.length} image(s) still point at local disk and will 404 in production:`);
    for (const row of localImages.slice(0, 5)) console.warn(`   ${row.image_url}`);
    console.warn('   Run: npm run db:migrate-uploads -- --yes');
  }

  // `is_admin` is an INTEGER on both engines — the schema stores booleans as
  // 0/1 so one set of SQL works against SQLite and PostgreSQL alike.
  const admins = await query<{ email: string }>('SELECT email FROM users WHERE is_admin = 1');
  console.info(
    admins.length > 0
      ? `\n👤 Admins: ${admins.map((row) => row.email).join(', ')}`
      : '\n👤 No admin account yet. Register, then run: npm run admin <email>',
  );
}

console.info('');
await db.close();

function hintFor(error: Error): string {
  const message = error.message.toLowerCase();
  if (message.includes('password authentication failed')) {
    return 'The password in DATABASE_URL is wrong. Reset it in Supabase under Project Settings → Database.';
  }
  if (message.includes('enotfound') || message.includes('eai_again')) {
    return 'That host does not resolve. New Supabase projects use the pooler host, not db.<ref>.supabase.co.';
  }
  if (message.includes('timeout') || message.includes('etimedout')) {
    return 'Connection timed out — usually an IPv6-only direct host. Use the pooler connection string instead.';
  }
  if (message.includes('tenant or user not found')) {
    return 'The pooler expects the user to be postgres.<project-ref>, not plain postgres.';
  }
  return 'Copy the URI from Supabase → Project Settings → Database → Connection string.';
}
