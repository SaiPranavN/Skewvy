import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { setupTestDatabase, teardownTestDatabase, truncateAll, createVerifiedUser } from './helpers';
import { SESSION_COOKIE, createSession } from '@/lib/services/sessions';
import { loadMoodStampBoard } from '@/lib/services/moodstamps';
import {
  formatMoodStampDate,
  moodStampBoardHref,
  parseMoodStampView,
  reactionLabel,
} from '@/lib/moodstamps/types';

const { GET: boardRoute } = await import('@/app/api/moodstamps/route');

beforeAll(async () => {
  await setupTestDatabase();
});
afterAll(teardownTestDatabase);
beforeEach(truncateAll);

function boardRequest(sessionToken?: string, query = ''): NextRequest {
  const request = new NextRequest(`http://localhost/api/moodstamps${query}`);
  if (sessionToken) request.cookies.set(SESSION_COOKIE, sessionToken);
  return request;
}

describe('MoodStamp views', () => {
  it('defaults to Received for anything that is not exactly "sent"', () => {
    expect(parseMoodStampView(undefined)).toBe('received');
    expect(parseMoodStampView(null)).toBe('received');
    expect(parseMoodStampView('received')).toBe('received');
    expect(parseMoodStampView('SENT')).toBe('received');
    expect(parseMoodStampView(['sent'])).toBe('received');
    expect(parseMoodStampView('sent')).toBe('sent');
  });

  it('builds the board URL for each view', () => {
    expect(moodStampBoardHref('received')).toBe('/moodstamps?view=received');
    expect(moodStampBoardHref('sent')).toBe('/moodstamps?view=sent');
  });

  it('names reactions in the singular and plural', () => {
    expect(reactionLabel('medal', 1)).toBe('Medal');
    expect(reactionLabel('medal', 45)).toBe('Medals');
    expect(reactionLabel('rotten_egg', 1)).toBe('Rotten Egg');
    expect(reactionLabel('rotten_egg', 2)).toBe('Rotten Eggs');
  });

  it('formats dates the same regardless of the machine timezone', () => {
    expect(formatMoodStampDate('2026-09-23T23:30:00.000Z')).toBe('Sep 23, 2026');
  });
});

describe('MoodStamp board', () => {
  it('is empty for a new account — nothing is invented to fill it', async () => {
    const userId = await createVerifiedUser();
    const board = await loadMoodStampBoard(userId);
    expect(board).toEqual({ received: [], sent: [], counts: { received: 0, sent: 0 } });
  });

  it('refuses to load without a user', async () => {
    await expect(loadMoodStampBoard('')).rejects.toThrow();
  });

  it('answers 401 to a request without a session', async () => {
    const response = await boardRoute(boardRequest());
    expect(response.status).toBe(401);
  });

  it('answers 401 to a forged session cookie', async () => {
    const response = await boardRoute(boardRequest('not-a-real-token'));
    expect(response.status).toBe(401);
  });

  it("returns the signed-in person's own board, privately, and ignores any id in the URL", async () => {
    const userId = await createVerifiedUser('owner@example.test');
    const otherId = await createVerifiedUser('other@example.test');
    const { token } = await createSession({ userId, ip: null, userAgent: null });

    const response = await boardRoute(boardRequest(token, `?userId=${otherId}&view=sent`));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ received: [], sent: [], counts: { received: 0, sent: 0 } });
  });
});

const { POST: createRoute } = await import('@/app/api/moodstamps/route');
const { getMoodStampForSender } = await import('@/lib/services/moodstamps');

const VALID_DRAFT = {
  reaction: 'rotten_egg',
  emotion: 'Fed up',
  quantity: 45,
  reasonWhat: 'You changed the project deadline without informing the team.',
  reasonImpact: 'I had to cancel other plans and work late.',
  reasonRequest: 'Please communicate changes before they are finalized.',
  recipientName: 'Aarav',
  anonymous: true,
};

function createRequest(body: unknown, sessionToken?: string): NextRequest {
  const request = new NextRequest('http://localhost/api/moodstamps', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
  if (sessionToken) request.cookies.set(SESSION_COOKIE, sessionToken);
  return request;
}

async function signedIn(email = 'sender@example.test') {
  const userId = await createVerifiedUser(email);
  const { token } = await createSession({ userId });
  return { userId, token };
}

describe('Sending a MoodStamp', () => {
  it('needs a session', async () => {
    const response = await createRoute(createRequest({ draft: VALID_DRAFT, delivery: { channel: 'download' } }));
    expect(response.status).toBe(401);
  });

  it('saves an email MoodStamp as awaiting delivery, never as delivered', async () => {
    const { userId, token } = await signedIn();
    const response = await createRoute(
      createRequest({ draft: VALID_DRAFT, delivery: { channel: 'email', email: ' Aarav@Example.COM ' } }, token),
    );
    expect(response.status).toBe(201);
    const { moodStamp } = await response.json();

    expect(moodStamp).toMatchObject({
      direction: 'sent',
      emotion: 'Fed up',
      reaction: 'rotten_egg',
      quantity: 45,
      recipientName: 'Aarav',
      anonymous: true,
      senderName: 'Tester',
      channel: 'email',
      destination: 'aarav@example.com',
      delivery: 'awaiting',
      opened: false,
    });
    expect(moodStamp.receiptCode).toMatch(/^SKV-[0-9A-F]{4}-045$/);
    expect(moodStamp.reasons).toEqual([VALID_DRAFT.reasonWhat, VALID_DRAFT.reasonImpact, VALID_DRAFT.reasonRequest]);

    const board = await loadMoodStampBoard(userId);
    expect(board.counts).toEqual({ received: 0, sent: 1 });
    expect(board.sent[0]).toMatchObject({ id: moodStamp.id, delivery: 'awaiting', counterpartName: 'Aarav' });
    // A summary carries no reasons and no address.
    expect(JSON.stringify(board.sent[0])).not.toContain('aarav@example.com');
    expect(board.received).toEqual([]);
  });

  it('records a WhatsApp number with its country code, and a download as handed over', async () => {
    const { token } = await signedIn();

    const whatsapp = await createRoute(
      createRequest({ draft: VALID_DRAFT, delivery: { channel: 'whatsapp', phone: '+919876543210' } }, token),
    );
    expect(whatsapp.status).toBe(201);
    expect((await whatsapp.json()).moodStamp).toMatchObject({ destination: '+919876543210', delivery: 'awaiting' });

    const download = await createRoute(createRequest({ draft: VALID_DRAFT, delivery: { channel: 'download' } }, token));
    expect(download.status).toBe(201);
    expect((await download.json()).moodStamp).toMatchObject({ destination: null, delivery: 'downloaded' });
  });

  it('refuses a number without a country code, and a malformed email', async () => {
    const { token } = await signedIn();
    const phone = await createRoute(
      createRequest({ draft: VALID_DRAFT, delivery: { channel: 'whatsapp', phone: '9876543210' } }, token),
    );
    expect(phone.status).toBe(422);
    expect((await phone.json()).fields).toHaveProperty('delivery.phone');

    const email = await createRoute(
      createRequest({ draft: VALID_DRAFT, delivery: { channel: 'email', email: 'not-an-email' } }, token),
    );
    expect(email.status).toBe(422);
  });

  it('refuses abusive language on the server, whatever the form did', async () => {
    const { userId, token } = await signedIn();

    for (const [field, value] of [
      ['reasonWhat', 'You are a f*cking idiot'],
      ['reasonImpact', 'I hope you die'],
      ['reasonRequest', 'send nudes'],
      ['emotion', 'Pissed'],
      ['recipientName', 'Chutiya'],
    ] as const) {
      const response = await createRoute(
        createRequest({ draft: { ...VALID_DRAFT, [field]: value }, delivery: { channel: 'download' } }, token),
      );
      expect(response.status, `${field}: ${value}`).toBe(422);
      expect((await response.json()).fields).toHaveProperty(`draft.${field}`);
    }

    expect((await loadMoodStampBoard(userId)).counts.sent).toBe(0);
  });

  it('refuses a draft with parts missing or out of range', async () => {
    const { token } = await signedIn();
    for (const draft of [
      { ...VALID_DRAFT, reaction: 'hug' },
      { ...VALID_DRAFT, quantity: 0 },
      { ...VALID_DRAFT, quantity: 101 },
      { ...VALID_DRAFT, quantity: 4.5 },
      { ...VALID_DRAFT, emotion: '12345' },
      { ...VALID_DRAFT, emotion: 'far too many words here' },
      { ...VALID_DRAFT, reasonWhat: '' },
      { ...VALID_DRAFT, reasonRequest: 'x'.repeat(111) },
      { ...VALID_DRAFT, recipientName: '   ' },
    ]) {
      const response = await createRoute(createRequest({ draft, delivery: { channel: 'download' } }, token));
      expect(response.status, JSON.stringify(draft)).toBe(422);
    }
  });

  it('takes the sender from the session, and shows a stamp to nobody else', async () => {
    const sender = await signedIn('first@example.test');
    const other = await signedIn('second@example.test');

    const response = await createRoute(
      createRequest(
        { draft: VALID_DRAFT, delivery: { channel: 'download' }, senderId: other.userId, sender_id: other.userId },
        sender.token,
      ),
    );
    const { moodStamp } = await response.json();

    expect(await getMoodStampForSender(moodStamp.id, sender.userId)).not.toBeNull();
    expect(await getMoodStampForSender(moodStamp.id, other.userId)).toBeNull();
    expect((await loadMoodStampBoard(other.userId)).counts.sent).toBe(0);
  });
});
