import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, truncateAll, createVerifiedUser } from './helpers';
import { execute } from '@/lib/db';
import { SESSION_COOKIE, createSession } from '@/lib/services/sessions';
import { outbox } from '@/lib/services/email';
import { getMoodStampForSender } from '@/lib/services/moodstamps';
import { getMoodStampByToken, markMoodStampOpened } from '@/lib/services/moodstamp-delivery';
import { escapeHtml, renderMoodStampEmail } from '@/lib/moodstamps/email';

const { POST: createRoute } = await import('@/app/api/moodstamps/route');
const { POST: deliverRoute } = await import('@/app/api/moodstamps/[id]/deliver/route');
const { POST: openRoute } = await import('@/app/api/moodstamps/open/route');
const { POST: optOutPost, GET: optOutGet } = await import('@/app/api/moodstamps/opt-out/route');

beforeAll(async () => {
  await setupTestDatabase();
});
afterAll(teardownTestDatabase);
beforeEach(truncateAll);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const DRAFT = {
  reaction: 'medal',
  emotion: 'Impressed',
  quantity: 45,
  reasonWhat: 'You stayed late to help me finish the presentation.',
  reasonImpact: 'I felt supported when I was under pressure.',
  reasonRequest: 'Your effort did not go unnoticed. Thank you.',
  recipientName: 'Aarav',
  anonymous: false,
};

let counter = 0;
async function sender(displayName = 'Pranav') {
  counter += 1;
  const userId = await createVerifiedUser(`sender${counter}@example.test`);
  await execute('UPDATE users SET display_name = $1 WHERE id = $2', [displayName, userId]);
  const { token } = await createSession({ userId });
  return { userId, token, email: `sender${counter}@example.test` };
}

function post(url: string, body: unknown, token?: string): NextRequest {
  const request = new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
  if (token) request.cookies.set(SESSION_COOKIE, token);
  return request;
}

async function send(token: string, draft: Record<string, unknown> = DRAFT, email = 'aarav@example.com') {
  const response = await createRoute(post('http://localhost/api/moodstamps', { draft, delivery: { channel: 'email', email } }, token));
  expect(response.status).toBe(201);
  return (await response.json()).moodStamp;
}

function linkToken(): string {
  const text = outbox().at(-1)!.text;
  return text.match(/\/moodstamps\/open\/([A-Za-z0-9_-]+)/)![1];
}

describe('Emailing a MoodStamp', () => {
  it('sends it to the recipient and marks it delivered', async () => {
    const { userId, token } = await sender();
    const stamp = await send(token, DRAFT, ' Aarav@Example.com ');

    expect(stamp).toMatchObject({ delivery: 'delivered', deliveryError: null });
    const message = outbox().at(-1)!;
    expect(message.to).toBe('aarav@example.com');
    expect(message.subject).toBe('Pranav sent you a MoodStamp');
    expect(message.html).toContain('>Impressed<');
    expect(message.html).toContain('You stayed late to help me finish the presentation.');
    expect(message.text).toContain('Open your MoodStamp: ');
    expect(message.headers?.['List-Unsubscribe']).toMatch(/^<.+\/api\/moodstamps\/opt-out\?token=.+>$/);
    expect(message.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');

    const saved = await getMoodStampForSender(stamp.id, userId);
    expect(saved?.delivery).toBe('delivered');
  });

  it('never puts an anonymous sender’s name, or any sender’s email address, in the message', async () => {
    const { token, email } = await sender('Secret Sender');
    await send(token, { ...DRAFT, anonymous: true });

    const message = outbox().at(-1)!;
    expect(message.subject).toBe('Someone sent you a MoodStamp');
    for (const part of [message.subject, message.html, message.text]) {
      expect(part).not.toContain('Secret Sender');
      expect(part).not.toContain(email);
    }
    expect(message.html).toContain('Identity verified by Skewvy');
  });

  it('does not print a display name that would fail the language checks', async () => {
    const { token } = await sender('Big Idiot');
    await send(token);
    expect(outbox().at(-1)!.subject).toBe('A Skewvy member sent you a MoodStamp');
    expect(outbox().at(-1)!.html).not.toContain('Big Idiot');
  });

  it('escapes everything a person typed', () => {
    const email = renderMoodStampEmail({
      data: {
        reaction: 'rotten_egg',
        emotion: 'Fed up',
        quantity: 3,
        senderName: '<img src=x onerror=alert(1)>',
        anonymous: false,
        recipientName: '<b>Aarav</b>',
        reasons: ['"quoted" & <script>', 'fine', 'fine'],
        receiptCode: 'SKV-0000-003',
        date: '2026-09-29T00:00:00.000Z',
        state: 'unopened',
      },
      openUrl: 'https://skewvy.com/moodstamps/open/token',
      optOutUrl: 'https://skewvy.com/moodstamps/opt-out/token',
      oneClickOptOutUrl: 'https://skewvy.com/api/moodstamps/opt-out?token=token',
      reportUrl: 'https://skewvy.com/report',
    });
    expect(email.html).not.toContain('<b>Aarav</b>');
    expect(email.html).not.toContain('<script>');
    expect(email.html).not.toContain('<img src=x');
    expect(email.html).toContain(escapeHtml('<b>Aarav</b>'));
    expect(email.html).toContain('&quot;quoted&quot; &amp; &lt;script&gt;');
  });

  it('keeps a failed send, says why, and lets the sender try again', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"down"}', { status: 500 })));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { userId, token } = await sender();
    const stamp = await send(token);
    expect(stamp).toMatchObject({ delivery: 'awaiting', deliveryError: 'send_failed' });

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 'msg_123' })));
    const retry = await deliverRoute(post(`http://localhost/api/moodstamps/${stamp.id}/deliver`, {}, token), {
      params: Promise.resolve({ id: stamp.id }),
    });
    expect(retry.status).toBe(200);
    expect((await retry.json()).moodStamp).toMatchObject({ delivery: 'delivered', deliveryError: null });

    const again = await deliverRoute(post(`http://localhost/api/moodstamps/${stamp.id}/deliver`, {}, token), {
      params: Promise.resolve({ id: stamp.id }),
    });
    expect((await again.json()).status).toBe('skipped');
    expect((await getMoodStampForSender(stamp.id, userId))?.delivery).toBe('delivered');
  });

  it('refuses to pretend in production when no provider is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', '');
    const { token } = await sender();
    const before = outbox().length;
    const stamp = await send(token);
    expect(stamp).toMatchObject({ delivery: 'awaiting', deliveryError: 'not_configured' });
    expect(outbox().length).toBe(before);
  });

  it('only lets the sender send it', async () => {
    const owner = await sender();
    const stranger = await sender();
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const stamp = await send(owner.token);
    vi.unstubAllGlobals();

    const unauthenticated = await deliverRoute(post(`http://localhost/api/moodstamps/${stamp.id}/deliver`, {}), {
      params: Promise.resolve({ id: stamp.id }),
    });
    expect(unauthenticated.status).toBe(401);

    const other = await deliverRoute(post(`http://localhost/api/moodstamps/${stamp.id}/deliver`, {}, stranger.token), {
      params: Promise.resolve({ id: stamp.id }),
    });
    expect(other.status).toBe(404);
  });
});

describe('The recipient', () => {
  it('opens the stamp through the private link, and it shows as opened to the sender', async () => {
    const { userId, token } = await sender('Hidden Name');
    const stamp = await send(token, { ...DRAFT, anonymous: true });
    const link = linkToken();

    const received = await getMoodStampByToken(link);
    expect(received?.artwork.senderName).toBe('Anonymous');
    expect(JSON.stringify(received)).not.toContain('Hidden Name');
    expect(received?.artwork.reasons[0]).toBe(DRAFT.reasonWhat);

    expect((await getMoodStampForSender(stamp.id, userId))?.opened).toBe(false);
    const opened = await openRoute(post('http://localhost/api/moodstamps/open', { token: link }));
    expect(opened.status).toBe(200);
    expect((await getMoodStampForSender(stamp.id, userId))?.opened).toBe(true);
    expect(await markMoodStampOpened(link)).toBe(true);
  });

  it('gets nothing for a made-up link', async () => {
    expect(await getMoodStampByToken('not-a-real-token-at-all')).toBeNull();
    const opened = await openRoute(post('http://localhost/api/moodstamps/open', { token: 'not-a-real-token-at-all' }));
    expect(opened.status).toBe(404);
  });

  it('can stop all MoodStamps to their address, from anyone', async () => {
    const first = await sender();
    await send(first.token);
    const link = linkToken();

    // A scanner following the link does not unsubscribe anyone.
    const scanned = await optOutGet(new NextRequest(`http://localhost/api/moodstamps/opt-out?token=${link}`));
    expect(scanned.status).toBe(307);
    expect(scanned.headers.get('location')).toContain(`/moodstamps/opt-out/${link}`);

    const oneClick = await optOutPost(
      new NextRequest(`http://localhost/api/moodstamps/opt-out?token=${link}`, {
        method: 'POST',
        body: 'List-Unsubscribe=One-Click',
      }),
    );
    expect(oneClick.status).toBe(200);

    const second = await sender();
    const before = outbox().length;
    const stamp = await send(second.token, DRAFT, 'AARAV@example.com');
    expect(stamp).toMatchObject({ delivery: 'awaiting', deliveryError: 'opted_out' });
    expect(outbox().length).toBe(before);
  });

  it('is sent at most five MoodStamps a day, from everyone together', async () => {
    for (let index = 0; index < 5; index += 1) {
      const { token } = await sender();
      expect((await send(token, DRAFT, 'popular@example.com')).delivery).toBe('delivered');
    }
    const { token } = await sender();
    expect(await send(token, DRAFT, 'popular@example.com')).toMatchObject({
      delivery: 'awaiting',
      deliveryError: 'recipient_limit',
    });
  });
});
