import { query, execute, getDb } from '@/lib/db';
import { migrate } from '@/lib/db/migrate';
import { hashPin } from '@/lib/services/pin';
import { revokeAllSessionsForUser } from '@/lib/services/sessions';
import { newId } from '@/lib/services/crypto';
import { pinSchema } from '@/lib/validation/schemas';

/**
 * Sets an account's PIN directly, creating the account if it does not exist.
 *
 *   npm run pin -- you@example.com my-new-pin
 *   npm run pin -- you@example.com my-new-pin --admin
 *
 * This is the operator's way back in when nobody can receive email — a locked
 * account with no reachable inbox would otherwise be unrecoverable. It runs
 * against the database directly and is never exposed over HTTP.
 */
const [emailArg, pinArg, ...flags] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
const pin = pinArg;
const makeAdmin = flags.includes('--admin');

if (!email || !pin) {
  console.error('Usage: npm run pin -- <email> <new-pin> [--admin]');
  process.exit(1);
}

const validation = pinSchema.safeParse(pin);
if (!validation.success) {
  console.error(`❌ ${validation.error.issues[0]?.message ?? 'That PIN is not acceptable.'}`);
  process.exit(1);
}

await migrate();

const now = new Date().toISOString();
const pinHash = await hashPin(pin);
const existing = await query<{ id: string; display_name: string }>(
  'SELECT id, display_name FROM users WHERE email_normalized = $1',
  [email],
);

if (existing.length > 0) {
  const user = existing[0];
  await execute(
    `UPDATE users SET pin_hash = $1, pin_failed_attempts = 0, pin_locked_until = NULL,
            email_verified_at = COALESCE(email_verified_at, $2),
            is_admin = CASE WHEN $3 = 1 THEN 1 ELSE is_admin END,
            updated_at = $2
      WHERE id = $4`,
    [pinHash, now, makeAdmin ? 1 : 0, user.id],
  );
  // Same rule the reset flow follows: a new PIN invalidates every old session.
  await revokeAllSessionsForUser(user.id);
  console.info(`✅ PIN updated for ${email}${makeAdmin ? ' (administrator)' : ''}. Other sessions signed out.`);
} else {
  const displayName = email.split('@')[0];
  await execute(
    `INSERT INTO users (id, display_name, email, email_normalized, pin_hash, email_verified_at, is_admin, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $6)`,
    [newId(), displayName, emailArg!.trim(), email, pinHash, now, makeAdmin ? 1 : 0],
  );
  console.info(`✅ Created ${email}${makeAdmin ? ' (administrator)' : ''} with the PIN you supplied.`);
}

console.info(`   Sign in at /login with ${email} and that PIN.`);

const db = await getDb();
await db.close();
