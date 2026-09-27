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
