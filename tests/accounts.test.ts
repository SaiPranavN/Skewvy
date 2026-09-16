import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  truncateAll,
  createTestFlashNews,
  createVerifiedUser,
} from './helpers';
import { listAccounts, suspendAccount, restoreAccount, deleteAccount } from '@/lib/services/accounts';
import { applyReactionBatch } from '@/lib/services/reactions';
import { createComment, listComments } from '@/lib/services/comments';
import { loginWithPin } from '@/lib/services/auth';
import { createSession, resolveSession } from '@/lib/services/sessions';
import { getTotals } from '@/lib/services/totals';
import { reactionTrend } from '@/lib/services/timeline';
import { execute, query } from '@/lib/db';

beforeAll(setupTestDatabase);
afterAll(teardownTestDatabase);
beforeEach(truncateAll);

const DEVICE = { userAgent: 'TestBrowser/1.0', ip: '198.51.100.10' };

async function admin(email = 'admin@example.test') {
  const id = await createVerifiedUser(email);
  await execute('UPDATE users SET is_admin = 1 WHERE id = $1', [id]);
  return id;
}

describe('listing accounts', () => {
  it('reports what each person has contributed', async () => {
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser('busy@example.test');

    await applyReactionBatch({
      userId,
      artifactType: 'flash_news',
      artifactId,
      reactionType: 'medal',
      quantity: 9,
      clientBatchId: 'accounts-1',
    });
    await createComment({ userId, artifactType: 'flash_news', artifactId, body: 'Something to say.' });

    const page = await listAccounts();
    const account = page.accounts.find((row) => row.email === 'busy@example.test')!;

    expect(account.reactionCount).toBe(9);
    expect(account.opinionCount).toBe(1);
    expect(account.commentCount).toBe(1);
    expect(account.suspendedAt).toBeNull();
  });

  it('searches by name and by address', async () => {
    await createVerifiedUser('findme@example.test');
    await createVerifiedUser('someone.else@example.test');

    expect((await listAccounts({ search: 'findme' })).accounts).toHaveLength(1);
    expect((await listAccounts({ search: 'FINDME' })).accounts).toHaveLength(1);
    expect((await listAccounts({ search: 'nobody' })).accounts).toHaveLength(0);
    // An empty search is not a filter.
    expect((await listAccounts({ search: '' })).accounts).toHaveLength(2);
  });
});

describe('suspension', () => {
  it('signs them out everywhere and refuses the next sign-in', async () => {
    const adminId = await admin();
    const userId = await createVerifiedUser('suspended@example.test');
    const session = await createSession({ userId, ...DEVICE });

    expect(await resolveSession(session.token)).not.toBeNull();

    expect(await suspendAccount({ userId, actingAdminId: adminId, reason: 'Spam' })).toBe('done');

    // The live session dies immediately — not at its next expiry.
    expect(await resolveSession(session.token)).toBeNull();

    const login = await loginWithPin({ email: 'suspended@example.test', pin: 'correct-horse-1', ...DEVICE });
    expect(login.status).toBe('suspended');
    if (login.status === 'suspended') expect(login.reason).toBe('Spam');
  });

  it('is told apart from a wrong PIN only once the PIN is right', async () => {
    const adminId = await admin();
    const userId = await createVerifiedUser('quiet@example.test');
    await suspendAccount({ userId, actingAdminId: adminId });

    /*
     * Answering "suspended" to a wrong PIN would turn sign-in into a way of
     * discovering which addresses have accounts.
     */
    const wrong = await loginWithPin({ email: 'quiet@example.test', pin: 'not-the-pin', ...DEVICE });
    expect(wrong.status).toBe('invalid_credentials');
  });

  it('keeps everything they wrote, and gives it back on restore', async () => {
    const adminId = await admin();
    const artifactId = await createTestFlashNews();
    const userId = await createVerifiedUser('kept@example.test');

    await applyReactionBatch({
      userId,
      artifactType: 'flash_news',
      artifactId,
      reactionType: 'rotten_egg',
      quantity: 5,
      clientBatchId: 'suspend-keeps-1',
    });
    await createComment({ userId, artifactType: 'flash_news', artifactId, body: 'Still here.' });

    await suspendAccount({ userId, actingAdminId: adminId });

    expect((await getTotals('flash_news', artifactId)).rottenEggTotal).toBe(5);
    expect((await listComments('flash_news', artifactId, {})).total).toBe(1);

    expect(await restoreAccount(userId)).toBe('done');
    const login = await loginWithPin({ email: 'kept@example.test', pin: 'correct-horse-1', ...DEVICE });
    expect(login.status).toBe('success');
  });

  it('refuses to lock out the acting admin or another admin', async () => {
    const adminId = await admin();
    const otherAdmin = await admin('second@example.test');

    expect(await suspendAccount({ userId: adminId, actingAdminId: adminId })).toBe('refused_self');
    expect(await suspendAccount({ userId: otherAdmin, actingAdminId: adminId })).toBe('refused_admin');
  });
});

describe('deletion', () => {
  it('removes everything they contributed and corrects the public totals', async () => {
    const adminId = await admin();
    const artifactId = await createTestFlashNews();
    const doomed = await createVerifiedUser('doomed@example.test');
    const survivor = await createVerifiedUser('survivor@example.test');

    await applyReactionBatch({
      userId: doomed,
      artifactType: 'flash_news',
      artifactId,
      reactionType: 'rotten_egg',
      quantity: 40,
      clientBatchId: 'delete-1',
    });
    await applyReactionBatch({
      userId: survivor,
      artifactType: 'flash_news',
      artifactId,
      reactionType: 'rotten_egg',
      quantity: 10,
      clientBatchId: 'delete-2',
    });
    await createComment({ userId: doomed, artifactType: 'flash_news', artifactId, body: 'Gone soon.' });

    expect((await getTotals('flash_news', artifactId)).rottenEggTotal).toBe(50);

    expect(await deleteAccount({ userId: doomed, actingAdminId: adminId })).toBe('done');

    // The counters are not left claiming reactions that no longer exist.
    const totals = await getTotals('flash_news', artifactId);
    expect(totals.rottenEggTotal).toBe(10);
    expect(totals.negativeOpinionTotal).toBe(1);
    expect(totals.uniqueParticipantTotal).toBe(1);

    expect((await listComments('flash_news', artifactId, {})).total).toBe(0);
    expect(await query('SELECT id FROM users WHERE id = $1', [doomed])).toHaveLength(0);
  });

  it('leaves the chart ending on the total it is drawn beside', async () => {
    const adminId = await admin();
    const artifactId = await createTestFlashNews();
    const doomed = await createVerifiedUser('doomed2@example.test');
    const survivor = await createVerifiedUser('survivor2@example.test');

    for (const [userId, quantity, batch] of [
      [doomed, 40, 'trend-1'],
      [survivor, 10, 'trend-2'],
    ] as const) {
      await applyReactionBatch({
        userId,
        artifactType: 'flash_news',
        artifactId,
        reactionType: 'medal',
        quantity,
        clientBatchId: batch,
      });
    }

    await deleteAccount({ userId: doomed, actingAdminId: adminId });

    /*
     * The rollup cannot subtract what it already summed, so it is rebuilt.
     * Without that the line would keep reporting the deleted person's medals
     * while the total beside it said otherwise.
     */
    const trend = await reactionTrend('flash_news', artifactId);
    const totals = await getTotals('flash_news', artifactId);
    const last = trend.points[trend.points.length - 1];

    expect(totals.medalTotal).toBe(10);
    expect(last.cumulativeMedals).toBe(totals.medalTotal);
  });

  it('refuses to delete the acting admin or another admin', async () => {
    const adminId = await admin();
    const otherAdmin = await admin('second2@example.test');

    expect(await deleteAccount({ userId: adminId, actingAdminId: adminId })).toBe('refused_self');
    expect(await deleteAccount({ userId: otherAdmin, actingAdminId: adminId })).toBe('refused_admin');
    expect(await query('SELECT id FROM users')).toHaveLength(2);
  });

  it('reports a missing account rather than pretending to act', async () => {
    const adminId = await admin();
    expect(await deleteAccount({ userId: 'no-such-id', actingAdminId: adminId })).toBe('not_found');
    expect(await suspendAccount({ userId: 'no-such-id', actingAdminId: adminId })).toBe('not_found');
  });
});
