import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { query, execute, getDb } from '@/lib/db';
import { storageConfig, uploadImage } from '@/lib/services/storage';

/**
 * Moves images that still live on local disk into Supabase Storage.
 *
 * Uploads used to be written to `public/uploads`, which is gitignored and
 * therefore never deployed: the row keeps pointing at `/uploads/<name>`, the
 * file exists only on the machine that uploaded it, and the live site shows a
 * broken image. This finds those rows, sends the files to the bucket and
 * rewrites the URLs.
 *
 *   npm run db:migrate-uploads          list what would change
 *   npm run db:migrate-uploads -- --yes do it
 */

const confirmed = process.argv.includes('--yes');

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

interface Row {
  id: string;
  title: string;
  image_url: string;
}

const rows: Array<Row & { table: 'entities' | 'flash_news' }> = [
  ...(await query<Row>("SELECT id, name AS title, image_url FROM entities WHERE image_url LIKE '/uploads/%'")).map(
    (row) => ({ ...row, table: 'entities' as const }),
  ),
  ...(
    await query<Row>("SELECT id, headline AS title, image_url FROM flash_news WHERE image_url LIKE '/uploads/%'")
  ).map((row) => ({ ...row, table: 'flash_news' as const })),
];

if (rows.length === 0) {
  console.info('\n✅ Nothing to migrate — no content points at a local upload.\n');
  const db = await getDb();
  await db.close();
  process.exit(0);
}

console.info(`\n📦 ${rows.length} image${rows.length === 1 ? '' : 's'} still on local disk:\n`);
for (const row of rows) console.info(`   ${row.table.padEnd(11)} ${row.image_url}  (${row.title})`);

const config = storageConfig();
if (!config) {
  console.error('\n❌ Storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.\n');
  process.exit(1);
}

if (!confirmed) {
  console.info('\nRe-run with --yes to upload these and rewrite the URLs.\n');
  const db = await getDb();
  await db.close();
  process.exit(0);
}

console.info('');
let moved = 0;

for (const row of rows) {
  const filename = row.image_url.replace(/^\/uploads\//, '');
  const file = path.join(process.cwd(), 'public', 'uploads', filename);
  const type = MIME_BY_EXTENSION[path.extname(filename).toLowerCase()];

  if (!type) {
    console.warn(`   ⚠️  ${filename} — unrecognised image type, skipped`);
    continue;
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(file);
  } catch {
    // The file was uploaded from a different machine, so it cannot be
    // recovered here. Saying so is better than rewriting the row to nothing.
    console.warn(`   ⚠️  ${filename} — not on this machine, skipped`);
    continue;
  }

  const result = await uploadImage(new File([bytes], filename, { type }), config);
  if (!result.ok) {
    console.error(`   ❌ ${filename} — ${result.message}`);
    continue;
  }

  await execute(`UPDATE ${row.table} SET image_url = $1, updated_at = $2 WHERE id = $3`, [
    result.url,
    new Date().toISOString(),
    row.id,
  ]);

  console.info(`   ✅ ${row.title} → ${result.url}`);
  moved += 1;
}

console.info(`\n${moved} of ${rows.length} moved into Supabase Storage.\n`);

const db = await getDb();
await db.close();
