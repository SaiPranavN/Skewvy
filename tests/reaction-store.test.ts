import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { reactionStore, artifactKey } from '@/lib/client/reaction-store';
import { emptyTotals } from '@/lib/domain/types';

/**
 * The client reaction engine. Two properties matter most here:
 *
 *  1. A signed-out tap records nothing — not locally, not on the counter.
 *  2. A signed-in tap moves the counter immediately and is batched, not sent
 *     one request per tap.
 */

const ARTIFACT = { type: 'flash_news' as const, id: 'store-test-artifact' };

function seedState() {
  reactionStore.hydrate([
    {
      totals: { ...emptyTotals(ARTIFACT.type, ARTIFACT.id), rottenEggTotal: 100, medalTotal: 40 },
      contribution: { rottenEggCount: 0, medalCount: 0, stance: null },
    },
  ]);
}

/** `hydrate` defers its notification to a microtask. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  // The store is a module singleton; reset the slice these tests touch.
  const snapshot = reactionStore.getSnapshot();
  delete snapshot[artifactKey(ARTIFACT.type, ARTIFACT.id)];
  reactionStore.discardPending();
  reactionStore.setAuthenticated(false);
  reactionStore.setAuthRequiredHandler(null);
  seedState();
  await settle();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('signed out', () => {
  it('records nothing and asks for sign-in instead', () => {
    const onAuthRequired = vi.fn();
    reactionStore.setAuthRequiredHandler(onAuthRequired);

    const accepted = reactionStore.react(ARTIFACT.type, ARTIFACT.id, 'rotten_egg', 1);

    expect(accepted).toBe(false);
    expect(onAuthRequired).toHaveBeenCalledTimes(1);

    const state = reactionStore.get(ARTIFACT.type, ARTIFACT.id)!;
    // The public counter has not moved.
    expect(state.totals.rottenEggTotal).toBe(100);
    // Nor the opinion counts, nor the participant count.
    expect(state.totals.negativeOpinionTotal).toBe(0);
    expect(state.totals.uniqueParticipantTotal).toBe(0);
    // Nor the person's own contribution.
    expect(state.contribution.rottenEggCount).toBe(0);
    expect(state.contribution.stance).toBeNull();
    // And nothing is queued to be sent later.
    expect(reactionStore.pendingReactions()).toHaveLength(0);
  });

  it('stays at zero however many times it is tapped', () => {
    reactionStore.setAuthRequiredHandler(vi.fn());
    for (let index = 0; index < 20; index += 1) {
      reactionStore.react(ARTIFACT.type, ARTIFACT.id, 'medal', 1);
    }

    const state = reactionStore.get(ARTIFACT.type, ARTIFACT.id)!;
    expect(state.totals.medalTotal).toBe(40);
    expect(state.contribution.medalCount).toBe(0);
  });
});

describe('signed in', () => {
  it('moves the counter immediately, before any network call', () => {
    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    reactionStore.setAuthenticated(true);

    const accepted = reactionStore.react(ARTIFACT.type, ARTIFACT.id, 'rotten_egg', 1);

    expect(accepted).toBe(true);
    const state = reactionStore.get(ARTIFACT.type, ARTIFACT.id)!;
    expect(state.totals.rottenEggTotal).toBe(101);
    expect(state.contribution.rottenEggCount).toBe(1);
    expect(state.contribution.stance).toBe('negative');
    // Nothing has been sent yet — the batch window has not elapsed.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('counts the person once in the opinion however many taps they send', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    reactionStore.setAuthenticated(true);

    for (let index = 0; index < 30; index += 1) {
      reactionStore.react(ARTIFACT.type, ARTIFACT.id, 'rotten_egg', 1);
    }

    const state = reactionStore.get(ARTIFACT.type, ARTIFACT.id)!;
    expect(state.totals.rottenEggTotal).toBe(130);
    expect(state.totals.negativeOpinionTotal).toBe(1);
    expect(state.totals.uniqueParticipantTotal).toBe(1);
  });

  it('moves the opinion across when the person switches sides', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    reactionStore.setAuthenticated(true);

    reactionStore.react(ARTIFACT.type, ARTIFACT.id, 'rotten_egg', 1);
    reactionStore.react(ARTIFACT.type, ARTIFACT.id, 'medal', 1);

    const state = reactionStore.get(ARTIFACT.type, ARTIFACT.id)!;
    expect(state.totals.negativeOpinionTotal).toBe(0);
    expect(state.totals.positiveOpinionTotal).toBe(1);
    // Still one person, and the Rotten Egg already sent is not withdrawn.
    expect(state.totals.uniqueParticipantTotal).toBe(1);
    expect(state.contribution.rottenEggCount).toBe(1);
  });

  it('collapses a burst of taps into a single batched request', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        totals: { ...emptyTotals(ARTIFACT.type, ARTIFACT.id), rottenEggTotal: 112, medalTotal: 40 },
        contribution: { rottenEggCount: 12, medalCount: 0, stance: 'negative' },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    reactionStore.setAuthenticated(true);

    for (let index = 0; index < 12; index += 1) {
      reactionStore.react(ARTIFACT.type, ARTIFACT.id, 'rotten_egg', 1);
    }

    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.quantity).toBe(12);
    expect(body.clientBatchId).toBeTruthy();
  });
});
