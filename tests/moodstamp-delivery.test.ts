import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, truncateAll, createVerifiedUser } from './helpers';
import { execute } from '@/lib/db';
import { SESSION_COOKIE, createSession } from '@/lib/services/sessions';
import { outbox } from '@/lib/services/email';
import { getMoodStampForSender, loadMoodStampBoard, openReceivedMoodStamp } from '@/lib/services/moodstamps';
import { getMoodStampByToken, markMoodStampOpened, sendDueMoodStampReminders } from '@/lib/services/moodstamp-delivery';
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
      assetBaseUrl: 'https://skewvy.com/email',
      siteUrl: 'https://skewvy.com',
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

  it('is emailed once a day; the rest wait in their Skewvy inbox', async () => {
    const first = await sender();
    expect(await send(first.token, DRAFT, 'popular@example.com')).toMatchObject({
      delivery: 'delivered',
      deliveryRoute: 'email',
    });
    const emailsAfterFirst = outbox().length;

    for (let index = 0; index < 4; index += 1) {
      const { token } = await sender();
      expect(await send(token, DRAFT, 'Popular@Example.com')).toMatchObject({
        delivery: 'delivered',
        deliveryRoute: 'inbox',
        deliveryError: null,
      });
    }
    expect(outbox().length).toBe(emailsAfterFirst);
  });

  it('lets one sender send the same address at most three a day', async () => {
    const { token } = await sender();
    for (let index = 0; index < 3; index += 1) {
      expect((await send(token, DRAFT, 'target@example.com')).delivery).toBe('delivered');
    }
    expect(await send(token, DRAFT, 'target@example.com')).toMatchObject({
      delivery: 'awaiting',
      deliveryError: 'recipient_limit',
    });
  });
});

describe('Reminders', () => {
  async function fillInbox(address: string, extra: number) {
    const first = await sender();
    await send(first.token, DRAFT, address);
    for (let index = 0; index < extra; index += 1) {
      const { token } = await sender();
      await send(token, { ...DRAFT, anonymous: true }, address);
    }
  }

  async function dayPasses() {
    const past = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    await execute('UPDATE moodstamp_recipients SET last_emailed_at = $1', [past]);
  }

  it('waits a day, then sends one reminder for everything held back, and only once', async () => {
    await fillInbox('waiting@example.com', 3);
    const before = outbox().length;

    expect((await sendDueMoodStampReminders()).sent).toBe(0);
    expect(outbox().length).toBe(before);

    await dayPasses();
    expect((await sendDueMoodStampReminders()).sent).toBe(1);
    const reminder = outbox().at(-1)!;
    expect(reminder.to).toBe('waiting@example.com');
    expect(reminder.subject).toBe('You have 3 MoodStamps waiting');
    expect(reminder.headers?.['List-Unsubscribe']).toBeTruthy();
    // No account holds this address yet: the way in is signing up with it.
    expect(reminder.text).toContain('/register?returnTo=');
    expect(reminder.text).toContain('Sign up with waiting@example.com');
    // It names nobody, and says nothing about what they felt.
    expect(reminder.html).not.toContain('Pranav');
    expect(reminder.html).not.toContain('Impressed');

    await dayPasses();
    expect((await sendDueMoodStampReminders()).sent).toBe(0);
  });

  it('points someone with an account at their board', async () => {
    await createVerifiedUser('member@example.com');
    await fillInbox('member@example.com', 1);
    await dayPasses();
    await sendDueMoodStampReminders();
    const reminder = outbox().at(-1)!;
    expect(reminder.subject).toBe('You have a MoodStamp waiting');
    expect(reminder.text).toContain('/moodstamps?view=received');
    expect(reminder.text).not.toContain('/register');
  });

  it('sends nothing to an address that opted out in the meantime', async () => {
    await fillInbox('quiet@example.com', 2);
    const link = outbox()
      .filter((message) => message.to === 'quiet@example.com')
      .at(0)!
      .text.match(/\/moodstamps\/open\/([A-Za-z0-9_-]+)/)![1];
    await optOutPost(new NextRequest(`http://localhost/api/moodstamps/opt-out?token=${link}`, { method: 'POST' }));

    await dayPasses();
    const before = outbox().length;
    expect((await sendDueMoodStampReminders()).sent).toBe(0);
    expect(outbox().length).toBe(before);
    expect((await sendDueMoodStampReminders()).waiting).toBe(0);
  });
});

describe('The Received board', () => {
  it('shows everything sent to the account’s verified email, however it arrived', async () => {
    const recipientId = await createVerifiedUser('reader@example.com');
    const named = await sender('Pranav');
    const hidden = await sender('Secret Sender');
    const emailed = await send(named.token, DRAFT, 'Reader@Example.com');
    const held = await send(hidden.token, { ...DRAFT, anonymous: true }, 'reader@example.com');
    expect(held.deliveryRoute).toBe('inbox');

    const board = await loadMoodStampBoard(recipientId, 'reader@example.com');
    expect(board.counts.received).toBe(2);
    expect(board.received.map((stamp) => stamp.id).sort()).toEqual([emailed.id, held.id].sort());
    expect(board.received.find((stamp) => stamp.id === emailed.id)).toMatchObject({
      direction: 'received',
      counterpartName: 'Pranav',
      opened: false,
    });
    expect(board.received.find((stamp) => stamp.id === held.id)).toMatchObject({ anonymous: true, counterpartName: null });
    expect(JSON.stringify(board.received)).not.toContain('Secret Sender');
  });

  it('holds stamps for an address until an account proves it owns it', async () => {
    const { token } = await sender();
    await send(token, DRAFT, 'later@example.com');

    const unverified = await createVerifiedUser('later@example.com');
    await execute('UPDATE users SET email_verified_at = NULL WHERE id = $1', [unverified]);
    const { receivingAddress } = await import('@/lib/services/moodstamps');
    expect(receivingAddress({ email: 'later@example.com', emailVerifiedAt: null })).toBeNull();
    expect((await loadMoodStampBoard(unverified, null)).received).toEqual([]);

    expect(receivingAddress({ email: 'Later@Example.com', emailVerifiedAt: new Date().toISOString() })).toBe(
      'later@example.com',
    );
    expect((await loadMoodStampBoard(unverified, 'later@example.com')).counts.received).toBe(1);
  });

  it('opens a stamp for its recipient, marks it opened, and hides an anonymous sender', async () => {
    const who = await sender('Secret Sender');
    const stamp = await send(who.token, { ...DRAFT, anonymous: true }, 'reader@example.com');

    expect(await openReceivedMoodStamp(stamp.id, 'someone-else@example.com')).toBeNull();
    const opened = await openReceivedMoodStamp(stamp.id, 'reader@example.com');
    expect(opened?.artwork.senderName).toBe('Anonymous');
    expect(JSON.stringify(opened)).not.toContain('Secret Sender');
    expect((await getMoodStampForSender(stamp.id, who.userId))?.opened).toBe(true);
  });

  it('never shows a stamp that was not delivered', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { token } = await sender();
    const stamp = await send(token, DRAFT, 'reader@example.com');
    expect(stamp.delivery).toBe('awaiting');
    expect((await loadMoodStampBoard('anyone', 'reader@example.com')).received).toEqual([]);
    expect(await openReceivedMoodStamp(stamp.id, 'reader@example.com')).toBeNull();
  });
});
