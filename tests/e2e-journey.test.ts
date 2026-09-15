import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, createTestFlashNews, tokenFromLastEmail } from './helpers';
import { SESSION_COOKIE } from '@/lib/services/sessions';
import { outbox } from '@/lib/services/email';
import { execute, query } from '@/lib/db';

/**
 * End-to-end journey, driven entirely through the real HTTP route handlers and
 * the real database:
 *
 *   register → verify by email → session expires → sign in with the PIN →
 *   send reactions (including a retried batch) → switch sides →
 *   see the updated public totals.
 *
 * Only Cloudflare is stubbed, since the test must not depend on the network.
 */
vi.mock('@/lib/services/turnstile', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/services/turnstile')>();
  return { ...original, verifyTurnstile: vi.fn(async () => ({ success: true, errorCodes: [] })) };
});

const { POST: registerRoute } = await import('@/app/api/auth/register/route');
const { POST: completeRoute } = await import('@/app/api/auth/complete-registration/route');
const { POST: loginRoute } = await import('@/app/api/auth/login/route');
const { POST: logoutRoute } = await import('@/app/api/auth/logout/route');
const { POST: batchRoute } = await import('@/app/api/reactions/batch/route');
const { GET: totalsRoute } = await import('@/app/api/artifacts/[type]/[id]/totals/route');

beforeAll(async () => {
  process.env.REQUIRE_EMAIL_VERIFICATION = '1';
  await setupTestDatabase();
});
afterAll(async () => {
  delete process.env.REQUIRE_EMAIL_VERIFICATION;
  await teardownTestDatabase();
});

const DEVICE = { userAgent: 'JourneyBrowser/1.0', ip: '198.51.100.44' };

function request(path: string, body: unknown, cookie?: string) {
  const headers = new Headers({
    'content-type': 'application/json',
    'user-agent': DEVICE.userAgent,
    'x-forwarded-for': DEVICE.ip,
  });
  if (cookie) headers.set('cookie', `${SESSION_COOKIE}=${cookie}`);
  return new NextRequest(`http://localhost:3000${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

function cookieFrom(response: Response): string | null {
  return response.headers.get('set-cookie')?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1] ?? null;
}

async function readTotals(artifactId: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', `${SESSION_COOKIE}=${cookie}`);
  const response = await totalsRoute(
    new NextRequest(`http://localhost:3000/api/artifacts/flash_news/${artifactId}/totals`, { headers }),
    { params: Promise.resolve({ type: 'flash_news', id: artifactId }) },
  );
  return response.json() as Promise<{
    totals: {
      rottenEggTotal: number;
      medalTotal: number;
      positiveOpinionTotal: number;
      negativeOpinionTotal: number;
      uniqueParticipantTotal: number;
    };
    contribution: { rottenEggCount: number; medalCount: number; stance: string | null } | null;
  }>;
}

describe('full Skewvy journey', () => {
  it('goes from a new account to a moved public counter', async () => {
    const artifactId = await createTestFlashNews('the-journey-item');

    /* 1. Step one: a name and an address. No account is created yet. */
    const registered = await registerRoute(
      request('/api/auth/register', {
        displayName: 'Journey Tester',
        email: 'journey@example.test',
        turnstileToken: 'ok',
        redirectTo: '/flash-news/the-journey-item',
      }),
    );
    expect(registered.status).toBe(200);
    expect(cookieFrom(registered)).toBeNull();
    expect(outbox()).toHaveLength(1);
    expect(await query('SELECT id FROM users')).toHaveLength(0);

    /* 2. Step two: open the link, choose a PIN. That is what makes the account. */
    const completed = await completeRoute(
      request('/api/auth/complete-registration', {
        token: tokenFromLastEmail(),
        pin: 'my-good-pin-42',
        confirmPin: 'my-good-pin-42',
        turnstileToken: 'ok',
      }),
    );
    expect(completed.status).toBe(200);

    const completedBody = (await completed.json()) as { redirectTo: string };
    expect(completedBody.redirectTo).toBe('/flash-news/the-journey-item');

    const firstSession = cookieFrom(completed)!;
    expect(firstSession).toBeTruthy();

    /* 3. React: three batches, the middle one retried after a "timeout". */
    const send = (quantity: number, clientBatchId: string, reactionType: 'rotten_egg' | 'medal', cookie: string) =>
      batchRoute(
        request(
          '/api/reactions/batch',
          { artifactType: 'flash_news', artifactId, reactionType, quantity, clientBatchId },
          cookie,
        ),
      );

    await send(30, 'journey-batch-one', 'rotten_egg', firstSession);
    await send(45, 'journey-batch-two', 'rotten_egg', firstSession);
    const retried = await send(45, 'journey-batch-two', 'rotten_egg', firstSession);

    const retriedBody = (await retried.json()) as { applied: boolean };
    expect(retriedBody.applied).toBe(false);

    const afterReacting = await readTotals(artifactId, firstSession);
    expect(afterReacting.totals.rottenEggTotal).toBe(75);
    expect(afterReacting.totals.negativeOpinionTotal).toBe(1);
    expect(afterReacting.totals.uniqueParticipantTotal).toBe(1);
    expect(afterReacting.contribution?.rottenEggCount).toBe(75);
    expect(afterReacting.contribution?.stance).toBe('negative');

    /* 4. The session expires. No new email may be required to get back in. */
    await execute('UPDATE sessions SET expires_at = $1', [new Date(Date.now() - 60_000).toISOString()]);

    const staleRead = await readTotals(artifactId, firstSession);
    expect(staleRead.contribution).toBeNull();
    expect(staleRead.totals.rottenEggTotal).toBe(75);

    const emailsBeforeLogin = outbox().length;

    /* 5. Sign back in with the email and PIN alone. */
    const loggedIn = await loginRoute(
      request('/api/auth/login', {
        email: 'journey@example.test',
        pin: 'my-good-pin-42',
        turnstileToken: 'ok',
      }),
    );
    expect(loggedIn.status).toBe(200);
    await expect(loggedIn.json()).resolves.toMatchObject({ status: 'success' });
    expect(outbox()).toHaveLength(emailsBeforeLogin);

    const secondSession = cookieFrom(loggedIn)!;
    expect(secondSession).not.toBe(firstSession);

    /* 6. The reaction history survives the new session. */
    const restored = await readTotals(artifactId, secondSession);
    expect(restored.contribution?.rottenEggCount).toBe(75);

    /* 7. Try to cross the floor. Refused — a side, once taken, is final. */
    const crossing = await send(6, 'journey-batch-three', 'medal', secondSession);
    expect(crossing.status).toBe(409);

    const crossingBody = (await crossing.json()) as {
      error: string;
      lockedTo: string;
      totals: { rottenEggTotal: number; medalTotal: number; positiveOpinionTotal: number; negativeOpinionTotal: number };
      contribution: { rottenEggCount: number; medalCount: number; stance: string };
    };

    expect(crossingBody.error).toBe('opinion_locked');
    expect(crossingBody.lockedTo).toBe('negative');
    expect(crossingBody.totals.medalTotal).toBe(0);
    expect(crossingBody.totals.positiveOpinionTotal).toBe(0);
    expect(crossingBody.totals.negativeOpinionTotal).toBe(1);
    expect(crossingBody.contribution.stance).toBe('negative');

    /* 8. The chosen side keeps accepting more. */
    await send(25, 'journey-batch-four', 'rotten_egg', secondSession);
    const deepened = await readTotals(artifactId, secondSession);
    expect(deepened.totals.rottenEggTotal).toBe(100);
    expect(deepened.contribution?.rottenEggCount).toBe(100);
    // Still one person on one side.
    expect(deepened.totals.negativeOpinionTotal).toBe(1);
    expect(deepened.totals.uniqueParticipantTotal).toBe(1);

    // Exactly one opinion row exists for this person and artifact, still.
    const opinions = await query('SELECT * FROM opinions');
    expect(opinions).toHaveLength(1);

    /* 9. A second person joins; totals and opinions both move correctly. */
    await registerRoute(
      request('/api/auth/register', {
        displayName: 'Second Voice',
        email: 'second@example.test',
        turnstileToken: 'ok',
      }),
    );
    const secondCompleted = await completeRoute(
      request('/api/auth/complete-registration', {
        token: tokenFromLastEmail(),
        pin: 'another-fine-pin-7',
        confirmPin: 'another-fine-pin-7',
        turnstileToken: 'ok',
      }),
    );
    const secondPerson = cookieFrom(secondCompleted)!;

    await send(120, 'second-person-batch-1', 'rotten_egg', secondPerson);

    const final = await readTotals(artifactId, secondPerson);
    expect(final.totals.rottenEggTotal).toBe(220);
    expect(final.totals.medalTotal).toBe(0);
    expect(final.totals.negativeOpinionTotal).toBe(2);
    expect(final.totals.positiveOpinionTotal).toBe(0);
    expect(final.totals.uniqueParticipantTotal).toBe(2);
    // Reactions measure intensity; opinions count people. The two never mix.
    expect(final.totals.rottenEggTotal + final.totals.medalTotal).not.toBe(
      final.totals.negativeOpinionTotal + final.totals.positiveOpinionTotal,
    );

    /* 10. Log out. The public totals stay; the personal view goes. */
    const loggedOut = await logoutRoute(request('/api/auth/logout', {}, secondPerson));
    expect(loggedOut.status).toBe(200);

    const anonymous = await readTotals(artifactId, secondPerson);
    expect(anonymous.contribution).toBeNull();
    expect(anonymous.totals.rottenEggTotal).toBe(220);
  });
});
