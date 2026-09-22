import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createSqliteDatabase } from '@/lib/db/sqlite';
import { __setDatabaseForTests, execute } from '@/lib/db';
import { migrate } from '@/lib/db/migrate';
import { clearOutbox, outbox } from '@/lib/services/email';
import type { Database } from '@/lib/db';

/**
 * Each test file gets its own throwaway SQLite database, so tests never share
 * state and can run against the real schema rather than a mock.
 */
let directory: string | null = null;
let database: Database | null = null;

export async function setupTestDatabase(): Promise<Database> {
  directory = mkdtempSync(path.join(tmpdir(), 'skewvy-test-'));
  database = createSqliteDatabase(path.join(directory, 'test.db'));
  __setDatabaseForTests(Promise.resolve(database));
  await migrate();
  clearOutbox();
  return database;
}

export async function teardownTestDatabase(): Promise<void> {
  await database?.close();
  __setDatabaseForTests(undefined);
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = null;
  database = null;
}

/** Wipes every table between tests without re-running the migration. */
export async function truncateAll(): Promise<void> {
  for (const table of [
    'comment_votes',
    'comments',
    'reaction_timeline',
    'opinion_timeline',
    'reaction_batches',
    'reaction_aggregates',
    'opinions',
    'artifact_totals',
    'flash_news_entities',
    'flash_news',
    'entities',
    'auth_tokens',
    'pending_registrations',
    'sessions',
    'rate_limits',
    'app_settings',
    'users',
  ]) {
    await execute(`DELETE FROM ${table}`);
  }
  clearOutbox();
}

/** Inserts a published Flash News item to react to. */
export async function createTestFlashNews(slug = 'test-item'): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO flash_news (id, slug, headline, summary, body, category, published_at, status, created_at, updated_at)
     VALUES ($1, $2, $3, '', '', 'Business', $4, 'published', $4, $4)`,
    [id, slug, `Headline for ${slug}`, now],
  );
  return id;
}

export async function createTestEntity(slug = 'test-entity'): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO entities (id, slug, name, description, category, status, created_at, updated_at)
     VALUES ($1, $2, $3, '', 'Business', 'published', $4, $4)`,
    [id, slug, `Entity ${slug}`, now],
  );
  return id;
}

/** Creates a verified account directly, skipping the email round trip. */
export async function createVerifiedUser(email = 'someone@example.test'): Promise<string> {
  const { hashPin } = await import('@/lib/services/pin');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO users (id, display_name, email, email_normalized, pin_hash, email_verified_at, created_at, updated_at)
     VALUES ($1, 'Tester', $2, $3, $4, $5, $5, $5)`,
    [id, email, email.toLowerCase(), await hashPin('correct-horse-1'), now],
  );
  return id;
}

/** Extracts the one-time link token from the most recent development email. */
export function tokenFromLastEmail(): string | null {
  const list = outbox();
  const last = list[list.length - 1];
  if (!last) return null;
  return last.text.match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

/**
 * Runs both halves of sign-up: request the link, then open it and set the PIN.
 *
 * Sign-up is two steps now, so a test that just wants an account has to walk
 * both. The result is whatever the *final* step returned, so a call site can go
 * on asking whether it ended in `signed_in` exactly as it did when sign-up was
 * one call. A first step that never reaches the second returns its own answer.
 */
export async function registerFully(options: {
  displayName?: string;
  email: string;
  pin: string;
  ip?: string | null;
  userAgent?: string | null;
  redirectTo?: string | null;
}) {
  const { beginRegistration } = await import('@/lib/services/registration');
  const { completeRegistration } = await import('@/lib/services/auth');

  const begun = await beginRegistration({
    displayName: options.displayName ?? 'Tester',
    email: options.email,
    ip: options.ip,
    redirectTo: options.redirectTo,
  });

  if (begun.status === 'account_exists' || begun.status === 'delivery_failed') return begun;

  const token = begun.status === 'ready_for_pin' ? begun.token : (await pendingTokenFor(options.email))!;

  return completeRegistration({
    token,
    pin: options.pin,
    ip: options.ip,
    userAgent: options.userAgent,
  });
}

/** The live link token for a sign-up that is waiting on its email. */
export async function pendingTokenFor(email: string): Promise<string | null> {
  const { outbox } = await import('@/lib/services/email');
  const message = [...outbox()].reverse().find((item) => item.to === email);
  const link = message?.text.match(/https?:\/\/\S+/)?.[0];
  return link ? new URL(link).searchParams.get('token') : null;
}
