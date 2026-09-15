import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  setupTestDatabase,
  teardownTestDatabase,
  truncateAll,
  createTestFlashNews,
  tokenFromLastEmail,
} from './helpers';
import { SESSION_COOKIE } from '@/lib/services/sessions';

/**
 * Integration tests that drive the real route handlers, including cookie
 * handling and Turnstile verification. Turnstile is stubbed at the module
 * boundary so the tests do not depend on Cloudflare being reachable.
 */
vi.mock('@/lib/services/turnstile', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/services/turnstile')>();
  return {
    ...original,
    verifyTurnstile: vi.fn(async (token: string) =>
      token === 'bad-token'
        ? { success: false, errorCodes: ['invalid-input-response'] }
        : { success: true, errorCodes: [] },
    ),
  };
});

const { POST: registerRoute } = await import('@/app/api/auth/register/route');
const { POST: verifyRoute } = await import('@/app/api/auth/verify/route');
const { POST: completeRoute } = await import('@/app/api/auth/complete-registration/route');
const { POST: loginRoute } = await import('@/app/api/auth/login/route');
const { POST: logoutRoute } = await import('@/app/api/auth/logout/route');
const { POST: requestResetRoute } = await import('@/app/api/auth/request-pin-reset/route');
const { POST: resetPinRoute } = await import('@/app/api/auth/reset-pin/route');
const { POST: batchRoute } = await import('@/app/api/reactions/batch/route');
const { GET: totalsRoute } = await import('@/app/api/artifacts/[type]/[id]/totals/route');
const { GET: commentsGet, POST: commentsPost } = await import('@/app/api/comments/route');
const { POST: votePost } = await import('@/app/api/comments/[id]/vote/route');

beforeAll(async () => {
  process.env.REQUIRE_EMAIL_VERIFICATION = '1';
  await setupTestDatabase();
});
afterAll(async () => {
  delete process.env.REQUIRE_EMAIL_VERIFICATION;
  await teardownTestDatabase();
});
beforeEach(truncateAll);

function post(path: string, body: unknown, options: { cookie?: string; userAgent?: string; ip?: string } = {}) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (options.cookie) headers.set('cookie', `${SESSION_COOKIE}=${options.cookie}`);
  headers.set('user-agent', options.userAgent ?? 'TestBrowser/1.0');
  headers.set('x-forwarded-for', options.ip ?? '198.51.100.10');

  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function sessionCookieFrom(response: Response): string | null {
  const header = response.headers.get('set-cookie');
  return header?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1] ?? null;
}

/** Walks both sign-up steps and returns the resulting session cookie. */
async function signUp(email = 'api@example.test', pin = 'correct-horse-1') {
  await registerRoute(
    post('/api/auth/register', { displayName: 'API Tester', email, turnstileToken: 'good-token' }),
  );

  const completed = await completeRoute(
    post('/api/auth/complete-registration', {
      token: tokenFromLastEmail(),
      pin,
      confirmPin: pin,
      turnstileToken: 'good-token',
    }),
  );
  return sessionCookieFrom(completed)!;
}

describe('POST /api/auth/register — step one', () => {
  it('takes a name and an address, and asks for nothing else', async () => {
    const response = await registerRoute(
      post('/api/auth/register', {
        displayName: 'API Tester',
        email: 'api@example.test',
        turnstileToken: 'good-token',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'verification_sent' });

    // No account yet: the address has not been proved.
    const { query } = await import('@/lib/db');
    expect(await query('SELECT id FROM users')).toHaveLength(0);
  });

  it('refuses a failed robot check before touching the database', async () => {
    const response = await registerRoute(
      post('/api/auth/register', {
        displayName: 'API Tester',
        email: 'api@example.test',
        turnstileToken: 'bad-token',
      }),
    );

    expect(response.status).toBe(400);
    const { query } = await import('@/lib/db');
    expect(await query('SELECT * FROM pending_registrations')).toHaveLength(0);
  });

  it('ignores a PIN sent to the first step', async () => {
    // The field does not exist here any more, and a caller that supplies one
    // must not have it stored or acted on.
    await registerRoute(
      post('/api/auth/register', {
        displayName: 'API Tester',
        email: 'api@example.test',
        pin: 'sneaky-pin-99',
        turnstileToken: 'good-token',
      }),
    );

    const { query } = await import('@/lib/db');
    expect(await query('SELECT id FROM users')).toHaveLength(0);
    const rows = await query<Record<string, unknown>>('SELECT * FROM pending_registrations');
    expect(JSON.stringify(rows)).not.toContain('sneaky-pin-99');
  });

  it('rate-limits repeated registrations from one address', async () => {
    const attempts: number[] = [];
    for (let index = 0; index < 7; index += 1) {
      const response = await registerRoute(
        post('/api/auth/register', {
          displayName: 'API Tester',
          email: `api-${index}@example.test`,
          pin: 'correct-horse-1',
          confirmPin: 'correct-horse-1',
          turnstileToken: 'good-token',
        }),
      );
      attempts.push(response.status);
    }

    expect(attempts).toContain(429);
  });
});

describe('POST /api/auth/login', () => {
  it('sets an HTTP-only session cookie on success', async () => {
    await signUp();

    const response = await loginRoute(
      post('/api/auth/login', { email: 'api@example.test', pin: 'correct-horse-1', turnstileToken: 'good-token' }),
    );

    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=lax');
    expect(cookie).toContain('Path=/');
  });

  it('returns an identical 401 for a wrong PIN and an unknown address', async () => {
    await signUp();

    const wrong = await loginRoute(
      post('/api/auth/login', { email: 'api@example.test', pin: 'not-the-pin-1', turnstileToken: 'good-token' }),
    );
    const unknown = await loginRoute(
      post('/api/auth/login', { email: 'ghost@example.test', pin: 'not-the-pin-1', turnstileToken: 'good-token' }),
    );

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });

  it('refuses a failed robot check', async () => {
    await signUp();
    const response = await loginRoute(
      post('/api/auth/login', { email: 'api@example.test', pin: 'correct-horse-1', turnstileToken: 'bad-token' }),
    );
    expect(response.status).toBe(400);
  });

  it('clears the cookie on logout', async () => {
    const cookie = await signUp();
    const response = await logoutRoute(post('/api/auth/logout', {}, { cookie }));

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/skewvy_session=;/);
  });
});

describe('POST /api/auth/reset-pin', () => {
  it('runs the whole forgot-PIN round trip', async () => {
    await signUp();

    const requested = await requestResetRoute(
      post('/api/auth/request-pin-reset', { email: 'api@example.test', turnstileToken: 'good-token' }),
    );
    expect(requested.status).toBe(200);

    const response = await resetPinRoute(
      post('/api/auth/reset-pin', {
        token: tokenFromLastEmail(),
        pin: 'a-whole-new-pin-5',
        confirmPin: 'a-whole-new-pin-5',
        turnstileToken: 'good-token',
      }),
    );

    expect(response.status).toBe(200);
    expect(sessionCookieFrom(response)).toBeTruthy();
  });

  it('answers the same way for an address with no account', async () => {
    const response = await requestResetRoute(
      post('/api/auth/request-pin-reset', { email: 'ghost@example.test', turnstileToken: 'good-token' }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'sent' });
  });
});

describe('POST /api/reactions/batch', () => {
  it('rejects an anonymous request', async () => {
    const artifactId = await createTestFlashNews();
    const response = await batchRoute(
      post('/api/reactions/batch', {
        artifactType: 'flash_news',
        artifactId,
        reactionType: 'rotten_egg',
        quantity: 12,
        clientBatchId: 'anonymous-batch-1',
      }),
    );

    expect(response.status).toBe(401);
  });

  it('applies a batch and returns authoritative totals', async () => {
    const cookie = await signUp();
    const artifactId = await createTestFlashNews();

    const response = await batchRoute(
      post(
        '/api/reactions/batch',
        {
          artifactType: 'flash_news',
          artifactId,
          reactionType: 'rotten_egg',
          quantity: 24,
          clientBatchId: 'batch-api-1',
        },
        { cookie },
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      applied: boolean;
      totals: { rottenEggTotal: number; negativeOpinionTotal: number };
      contribution: { rottenEggCount: number };
    };

    expect(body.applied).toBe(true);
    expect(body.totals.rottenEggTotal).toBe(24);
    expect(body.totals.negativeOpinionTotal).toBe(1);
    expect(body.contribution.rottenEggCount).toBe(24);
  });

  it('treats a repeated client batch id as a no-op', async () => {
    const cookie = await signUp();
    const artifactId = await createTestFlashNews();
    const payload = {
      artifactType: 'flash_news',
      artifactId,
      reactionType: 'medal',
      quantity: 15,
      clientBatchId: 'duplicate-batch',
    };

    await batchRoute(post('/api/reactions/batch', payload, { cookie }));
    const retry = await batchRoute(post('/api/reactions/batch', payload, { cookie }));
    const body = (await retry.json()) as { applied: boolean; totals: { medalTotal: number } };

    expect(body.applied).toBe(false);
    expect(body.totals.medalTotal).toBe(15);
  });

  it('refuses an implausible quantity', async () => {
    const cookie = await signUp();
    const artifactId = await createTestFlashNews();

    const response = await batchRoute(
      post(
        '/api/reactions/batch',
        {
          artifactType: 'flash_news',
          artifactId,
          reactionType: 'medal',
          quantity: 100_000,
          clientBatchId: 'too-big',
        },
        { cookie },
      ),
    );

    expect(response.status).toBe(422);
  });

  it('refuses an unknown artifact', async () => {
    const cookie = await signUp();

    const response = await batchRoute(
      post(
        '/api/reactions/batch',
        {
          artifactType: 'flash_news',
          artifactId: 'not-a-real-id',
          reactionType: 'medal',
          quantity: 5,
          clientBatchId: 'ghost-artifact',
        },
        { cookie },
      ),
    );

    expect(response.status).toBe(404);
  });

  it('rate-limits a flood of batches from one account', async () => {
    const cookie = await signUp();
    const artifactId = await createTestFlashNews();

    const statuses: number[] = [];
    for (let index = 0; index < 250; index += 1) {
      const response = await batchRoute(
        post(
          '/api/reactions/batch',
          {
            artifactType: 'flash_news',
            artifactId,
            reactionType: 'rotten_egg',
            quantity: 1,
            clientBatchId: `flood-batch-${index}`,
          },
          { cookie },
        ),
      );
      statuses.push(response.status);
      if (response.status === 429) break;
    }

    // The window allows 240 batches a minute; everything before that succeeds.
    expect(statuses.filter((status) => status === 200).length).toBe(240);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe('GET /api/artifacts/[type]/[id]/totals', () => {
  it('returns totals without a session and adds the contribution with one', async () => {
    const cookie = await signUp();
    const artifactId = await createTestFlashNews();

    await batchRoute(
      post(
        '/api/reactions/batch',
        { artifactType: 'flash_news', artifactId, reactionType: 'medal', quantity: 9, clientBatchId: 'totals-1' },
        { cookie },
      ),
    );

    const params = Promise.resolve({ type: 'flash_news', id: artifactId });

    const anonymous = await totalsRoute(
      new NextRequest(`http://localhost:3000/api/artifacts/flash_news/${artifactId}/totals`),
      { params },
    );
    const anonymousBody = (await anonymous.json()) as { totals: { medalTotal: number }; contribution: null };
    expect(anonymousBody.totals.medalTotal).toBe(9);
    expect(anonymousBody.contribution).toBeNull();

    const headers = new Headers({ cookie: `${SESSION_COOKIE}=${cookie}` });
    const authenticated = await totalsRoute(
      new NextRequest(`http://localhost:3000/api/artifacts/flash_news/${artifactId}/totals`, { headers }),
      { params: Promise.resolve({ type: 'flash_news', id: artifactId }) },
    );
    const authenticatedBody = (await authenticated.json()) as { contribution: { medalCount: number } };
    expect(authenticatedBody.contribution.medalCount).toBe(9);
  });

  it('rejects an unknown artifact type', async () => {
    const response = await totalsRoute(new NextRequest('http://localhost:3000/api/artifacts/moment/x/totals'), {
      params: Promise.resolve({ type: 'moment', id: 'x' }),
    });
    expect(response.status).toBe(400);
  });
});

describe('/api/comments', () => {
  it('refuses an anonymous post but serves the list to anyone', async () => {
    const artifactId = await createTestFlashNews();

    const refused = await commentsPost(
      post('/api/comments', { artifactType: 'flash_news', artifactId, body: 'Signed out.' }),
    );
    expect(refused.status).toBe(401);

    const listed = await commentsGet(
      new NextRequest(`http://localhost:3000/api/comments?artifactType=flash_news&artifactId=${artifactId}`),
    );
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({ total: 0 });
  });

  it('accepts a comment from an account that has never reacted', async () => {
    const artifactId = await createTestFlashNews();
    const cookie = await signUp();

    const response = await commentsPost(
      post('/api/comments', { artifactType: 'flash_news', artifactId, body: 'Not reacted, still opinionated.' }, { cookie }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { comment: { authorStance: string | null; body: string } };
    expect(body.comment.authorStance).toBeNull();
    expect(body.comment.body).toBe('Not reacted, still opinionated.');
  });

  it('rejects an empty comment', async () => {
    const artifactId = await createTestFlashNews();
    const cookie = await signUp();

    const response = await commentsPost(
      post('/api/comments', { artifactType: 'flash_news', artifactId, body: ' ' }, { cookie }),
    );
    expect(response.status).toBe(422);
  });

  it('records a like and withdraws it when sent again', async () => {
    const artifactId = await createTestFlashNews();
    const cookie = await signUp();

    const created = await commentsPost(
      post('/api/comments', { artifactType: 'flash_news', artifactId, body: 'Vote on me.' }, { cookie }),
    );
    const { comment } = (await created.json()) as { comment: { id: string } };

    const liked = await votePost(post(`/api/comments/${comment.id}/vote`, { value: 1 }, { cookie }), {
      params: Promise.resolve({ id: comment.id }),
    });
    await expect(liked.json()).resolves.toMatchObject({ likeCount: 1, viewerVote: 1 });

    const withdrawn = await votePost(post(`/api/comments/${comment.id}/vote`, { value: 1 }, { cookie }), {
      params: Promise.resolve({ id: comment.id }),
    });
    await expect(withdrawn.json()).resolves.toMatchObject({ likeCount: 0, viewerVote: 0 });
  });

  it('refuses an anonymous vote', async () => {
    const artifactId = await createTestFlashNews();
    const cookie = await signUp();
    const created = await commentsPost(
      post('/api/comments', { artifactType: 'flash_news', artifactId, body: 'Guarded.' }, { cookie }),
    );
    const { comment } = (await created.json()) as { comment: { id: string } };

    const response = await votePost(post(`/api/comments/${comment.id}/vote`, { value: -1 }), {
      params: Promise.resolve({ id: comment.id }),
    });
    expect(response.status).toBe(401);
  });
});
