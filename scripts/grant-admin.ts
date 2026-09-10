import { execute, query, getDb } from '@/lib/db';

/** Grants the admin flag to an existing account: `npm run admin -- you@example.com` */
const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run admin -- you@example.com');
  process.exit(1);
}

const rows = await query<{ id: string; display_name: string }>(
  'SELECT id, display_name FROM users WHERE email_normalized = $1',
  [email],
);

if (rows.length === 0) {
  console.error(`No account found for ${email}. Register first, then run this again.`);
  process.exit(1);
}

await execute('UPDATE users SET is_admin = 1, updated_at = $1 WHERE id = $2', [new Date().toISOString(), rows[0].id]);
console.info(`✅ ${rows[0].display_name} <${email}> is now an administrator.`);

const db = await getDb();
await db.close();
