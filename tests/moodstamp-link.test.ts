import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, truncateAll, createVerifiedUser } from './helpers';
import { execute, query } from '@/lib/db';
import { SESSION_COOKIE, createSession } from '@/lib/services/sessions';
import { outbox } from '@/lib/services/email';
import { getMoodStampForSender, loadMoodStampBoard, openReceivedMoodStamp } from '@/lib/services/moodstamps';
import { sendDueMoodStampReminders } from '@/lib/services/moodstamp-delivery';
import {
  LINK_CODE_PATTERN,
  ensureInboxLink,
  getInboxLink,
  resolveInboxLink,
  updateInboxLink,
} from '@/lib/services/moodstamp-inbox';

const { POST: sendRoute } = await import('@/app/api/moodstamps/to/[code]/route');
const { GET: linkGet, PATCH: linkPatch } = await import('@/app/api/moodstamps/inbox-link/route');

beforeAll(async () => {
  await setupTestDatabase();
});
afterAll(teardownTestDatabase);
beforeEach(async () => {
  await truncateAll();
  vi.stubEnv('TURNSTILE_DISABLED', '1');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const DRAFT = {
  reaction: 'medal',
  emotion: 'Grateful',
  quantity: 12,
  reasonWhat: 'You walked me through my first release.',
  reasonImpact: 'I stopped being scared of shipping.',
  reasonRequest: 'Thank you for your patience.',
  anonymous: false,
};

let counter = 0;
async function account(displayName: string, verified = true) {
  counter += 1;
  const email = `person${counter}@example.test`;
  const userId = await createVerifiedUser(email);
  await execute('UPDATE users SET display_name = $1 WHERE id = $2', [displayName, userId]);
  if (!verified) await execute('UPDATE users SET email_verified_at = NULL WHERE id = $1', [userId]);
  const { token } = await createSession({ userId });
  return { userId, token, email };
}

let ip = 0;
function request(url: string, init: { method: string; body?: unknown; token?: string; ip?: string }): NextRequest {
  ip += 1;
  const req = new NextRequest(url, {
    method: init.method,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': init.ip ?? `10.0.0.${ip % 250}` },
  });
  if (init.token) req.cookies.set(SESSION_COOKIE, init.token);
  return req;
}

async function sendThrough(code: string, body: Record<string, unknown>, options: { token?: string; ip?: string } = {}) {
  const response = await sendRoute(
    request(`http://localhost/api/moodstamps/to/${code}`, { method: 'POST', body, ...options }),
    { params: Promise.resolve({ code }) },
  );
  return { status: response.status, body: await response.json() };
}

describe('A person’s MoodStamp link', () => {
  it('is made once, on first asking, and is the same link after that', async () => {
    const owner = await account('Pranav');
    const first = await ensureInboxLink(owner.userId);
    const again = await ensureInboxLink(owner.userId);

    expect(first.code).toMatch(LINK_CODE_PATTERN);
    expect(first.url).toMatch(new RegExp(`/to/${first.code}$`));
    expect(again.code).toBe(first.code);
    expect(first).toMatchObject({ paused: false, notify: true, received: 0 });

    const response = await linkGet(request('http://localhost/api/moodstamps/inbox-link', { method: 'GET', token: owner.token }));
    expect((await response.json()).link.code).toBe(first.code);
  });

  it('resolves to its owner, and a new link stops the old one working', async () => {
    const owner = await account('Pranav');
    const { code } = await ensureInboxLink(owner.userId);
    expect(await resolveInboxLink(code.toUpperCase())).toMatchObject({ ownerId: owner.userId, ownerName: 'Pranav' });
    expect(await resolveInboxLink('nothere2')).toBeNull();
    expect(await resolveInboxLink('../etc')).toBeNull();

    const renewed = await updateInboxLink(owner.userId, { renew: true });
    expect(renewed?.code).not.toBe(code);
    expect(await resolveInboxLink(code)).toBeNull();
    expect(await resolveInboxLink(renewed!.code)).toMatchObject({ ownerId: owner.userId });
  });

  it('can only be changed by its owner, through their own session', async () => {
    const owner = await account('Pranav');
    await ensureInboxLink(owner.userId);

    const signedOut = await linkPatch(request('http://localhost/api/moodstamps/inbox-link', { method: 'PATCH', body: { paused: true } }));
    expect(signedOut.status).toBe(401);

    const paused = await linkPatch(
      request('http://localhost/api/moodstamps/inbox-link', { method: 'PATCH', body: { paused: true, notify: false }, token: owner.token }),
    );
    expect((await paused.json()).link).toMatchObject({ paused: true, notify: false });
    expect((await getInboxLink(owner.userId))?.paused).toBe(true);
  });
});

describe('Sending through a link', () => {
  it('takes a MoodStamp from someone with no account and puts it on the owner’s board', async () => {
    const owner = await account('Pranav', false);
    const { code } = await ensureInboxLink(owner.userId);

    const sent = await sendThrough(code, { draft: DRAFT, senderName: 'Priya' });
    expect(sent.status).toBe(201);
    expect(sent.body.moodStamp).toMatchObject({
      channel: 'link',
      delivery: 'delivered',
      recipientName: 'Pranav',
      senderName: 'Priya',
      senderVerified: false,
    });

    // Keyed to the account, not its address: it arrives even before the address is verified.
    const board = await loadMoodStampBoard(owner.userId, null);
    expect(board.counts.received).toBe(1);
    expect(board.received[0]).toMatchObject({ counterpartName: 'Priya', anonymous: false, opened: false });

    const opened = await openReceivedMoodStamp(board.received[0].id, null, owner.userId);
    expect(opened?.artwork).toMatchObject({ senderName: 'Priya', senderVerified: false, recipientName: 'Pranav' });
    expect((await loadMoodStampBoard(owner.userId, null)).received[0].opened).toBe(true);
  });

  it('addresses the stamp to the owner, whatever the draft says', async () => {
    const owner = await account('Pranav');
    const { code } = await ensureInboxLink(owner.userId);
    const sent = await sendThrough(code, { draft: { ...DRAFT, recipientName: 'Someone Else' }, senderName: 'Priya' });
    expect(sent.status).toBe(201);
    expect(sent.body.moodStamp.recipientName).toBe('Pranav');
  });

  it('asks someone without an account for a name, unless they send it anonymously', async () => {
    const owner = await account('Pranav');
    const { code } = await ensureInboxLink(owner.userId);

    const nameless = await sendThrough(code, { draft: DRAFT });
    expect(nameless.status).toBe(422);
    expect(nameless.body.fields.senderName).toBeTruthy();

    const anonymous = await sendThrough(code, { draft: { ...DRAFT, anonymous: true }, senderName: 'Priya' });
    expect(anonymous.status).toBe(201);
    const board = await loadMoodStampBoard(owner.userId, owner.email);
    expect(board.received[0]).toMatchObject({ anonymous: true, counterpartName: null });
    expect(JSON.stringify(board)).not.toContain('Priya');
  });

  it('holds a link send to the same language rules, name included', async () => {
    const owner = await account('Pranav');
    const { code } = await ensureInboxLink(owner.userId);

    const rude = await sendThrough(code, { draft: { ...DRAFT, reasonWhat: 'You are a useless idiot.' }, senderName: 'Priya' });
    expect(rude.status).toBe(422);
    expect(rude.body.fields['draft.reasonWhat']).toBeTruthy();

    const rudeName = await sendThrough(code, { draft: DRAFT, senderName: 'Big Idiot' });
    expect(rudeName.status).toBe(422);
    expect(rudeName.body.fields.senderName).toBeTruthy();
    expect((await loadMoodStampBoard(owner.userId, owner.email)).counts.received).toBe(0);
  });

  it('signs with the account of someone signed in, verified, and shows it on their Sent board', async () => {
    const owner = await account('Pranav');
    const writer = await account('Meera');
    const { code } = await ensureInboxLink(owner.userId);

    const sent = await sendThrough(code, { draft: DRAFT, senderName: 'Not Meera' }, { token: writer.token });
    expect(sent.status).toBe(201);
    expect(sent.body.moodStamp).toMatchObject({ senderName: 'Meera', senderVerified: true });

    const theirs = await loadMoodStampBoard(writer.userId, writer.email);
    expect(theirs.counts.sent).toBe(1);
    expect(theirs.sent[0]).toMatchObject({ counterpartName: 'Pranav', delivery: 'delivered' });
    expect(await getMoodStampForSender(sent.body.moodStamp.id, writer.userId)).toMatchObject({ channel: 'link' });
    expect(await getMoodStampForSender(sent.body.moodStamp.id, owner.userId)).toBeNull();
  });

  it('lets nobody but the owner open what came in', async () => {
    const owner = await account('Pranav');
    const stranger = await account('Stranger');
    const { code } = await ensureInboxLink(owner.userId);
    const sent = await sendThrough(code, { draft: DRAFT, senderName: 'Priya' });

    expect(await openReceivedMoodStamp(sent.body.moodStamp.id, stranger.email, stranger.userId)).toBeNull();
    expect((await loadMoodStampBoard(stranger.userId, stranger.email)).counts.received).toBe(0);
  });

  it('refuses a paused link, a replaced one, and the owner writing to themselves', async () => {
    const owner = await account('Pranav');
    const { code } = await ensureInboxLink(owner.userId);

    expect((await sendThrough(code, { draft: DRAFT, senderName: 'Priya' }, { token: owner.token })).status).toBe(400);

    await updateInboxLink(owner.userId, { paused: true });
    expect((await sendThrough(code, { draft: DRAFT, senderName: 'Priya' })).status).toBe(409);

    await updateInboxLink(owner.userId, { paused: false, renew: true });
    expect((await sendThrough(code, { draft: DRAFT, senderName: 'Priya' })).status).toBe(404);
  });

  it('lets one sender send one person three a day at most', async () => {
    const owner = await account('Pranav');
    const { code } = await ensureInboxLink(owner.userId);
    for (let index = 0; index < 3; index += 1) {
      expect((await sendThrough(code, { draft: DRAFT, senderName: 'Priya' }, { ip: '203.0.113.9' })).status).toBe(201);
    }
    const fourth = await sendThrough(code, { draft: DRAFT, senderName: 'Priya' }, { ip: '203.0.113.9' });
    expect(fourth.status).toBe(429);
    expect(fourth.body.message).toContain('three MoodStamps today');
    expect((await sendThrough(code, { draft: DRAFT, senderName: 'Rahul' }, { ip: '203.0.113.10' })).status).toBe(201);
  });

  it('requires the robot check from someone without an account', async () => {
    vi.stubEnv('TURNSTILE_DISABLED', '0');
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site');
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: false, 'error-codes': ['invalid-input-response'] })));

    const owner = await account('Pranav');
    const { code } = await ensureInboxLink(owner.userId);
    const failed = await sendThrough(code, { draft: DRAFT, senderName: 'Priya', turnstileToken: 'bad' });
    expect(failed.status).toBe(400);
    expect((await loadMoodStampBoard(owner.userId, owner.email)).counts.received).toBe(0);
  });
});

describe('Telling the owner', () => {
  async function dayPasses() {
    const past = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    await execute('UPDATE moodstamp_recipients SET last_emailed_at = $1', [past]);
  }

  it('emails a verified owner once a day about what came in, never naming who sent it', async () => {
    const owner = await account('Pranav');
    const { code } = await ensureInboxLink(owner.userId);
    await sendThrough(code, { draft: DRAFT, senderName: 'Priya' });
    await sendThrough(code, { draft: DRAFT, senderName: 'Rahul' });

    expect((await sendDueMoodStampReminders()).sent).toBe(1);
    const notice = outbox().at(-1)!;
    expect(notice.to).toBe(owner.email);
    expect(notice.subject).toBe('You have 2 MoodStamps waiting');
    expect(notice.text).toContain('came in through your MoodStamp link');
    expect(notice.text).toContain('/moodstamps?view=received');
    for (const part of [notice.subject, notice.html, notice.text]) {
      expect(part).not.toContain('Priya');
      expect(part).not.toContain('Grateful');
    }

    // Another arrives the same day: it waits for tomorrow's email.
    await sendThrough(code, { draft: DRAFT, senderName: 'Asha' });
    const before = outbox().length;
    expect((await sendDueMoodStampReminders()).sent).toBe(0);
    expect(outbox().length).toBe(before);

    await dayPasses();
    expect((await sendDueMoodStampReminders()).sent).toBe(1);
    expect(outbox().at(-1)!.subject).toBe('You have a MoodStamp waiting');
    expect((await sendDueMoodStampReminders()).waiting).toBe(0);
  });

  it('does not email an owner who turned it off, has no verified address, or already opened them', async () => {
    const quiet = await account('Quiet');
    await ensureInboxLink(quiet.userId);
    await updateInboxLink(quiet.userId, { notify: false });
    const unverified = await account('Unverified', false);
    const reader = await account('Reader');

    for (const person of [quiet, unverified, reader]) {
      const { code } = await ensureInboxLink(person.userId);
      await sendThrough(code, { draft: DRAFT, senderName: 'Priya' });
    }
    const [stamp] = await query<{ id: string }>('SELECT id FROM moodstamp_link_stamps WHERE recipient_id = $1', [
      reader.userId,
    ]);
    await openReceivedMoodStamp(stamp.id, reader.email, reader.userId);

    const before = outbox().length;
    expect((await sendDueMoodStampReminders()).sent).toBe(0);
    expect(outbox().length).toBe(before);
  });
});
