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

describe('picking a position', () => {
  it('lets an undecided person move between the two sides freely', () => {
    reactionStore.setAuthenticated(true);

    expect(reactionStore.select(ARTIFACT.type, ARTIFACT.id, 'positive')).toBe(true);
    expect(reactionStore.get(ARTIFACT.type, ARTIFACT.id)!.selectedStance).toBe('positive');

    expect(reactionStore.select(ARTIFACT.type, ARTIFACT.id, 'negative')).toBe(true);
    expect(reactionStore.get(ARTIFACT.type, ARTIFACT.id)!.selectedStance).toBe('negative');

    // Selecting is not reacting: nothing has moved and nothing is queued.
    const state = reactionStore.get(ARTIFACT.type, ARTIFACT.id)!;
    expect(state.totals.rottenEggTotal).toBe(100);
    expect(state.totals.negativeOpinionTotal).toBe(0);
    expect(state.contribution.stance).toBeNull();
    expect(reactionStore.pendingReactions()).toHaveLength(0);
  });

  it('is also free while signed out, since it records nothing', () => {
    expect(reactionStore.select(ARTIFACT.type, ARTIFACT.id, 'negative')).toBe(true);
    expect(reactionStore.get(ARTIFACT.type, ARTIFACT.id)!.selectedStance).toBe('negative');
  });

  it('is committed by the first reaction, and cannot be moved afterwards', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    reactionStore.setAuthenticated(true);

    reactionStore.select(ARTIFACT.type, ARTIFACT.id, 'negative');
    reactionStore.react(ARTIFACT.type, ARTIFACT.id, 'rotten_egg', 1);

    expect(reactionStore.get(ARTIFACT.type, ARTIFACT.id)!.contribution.stance).toBe('negative');

    // The other side is now refused, and the selection stays where it was.
    expect(reactionStore.select(ARTIFACT.type, ARTIFACT.id, 'positive')).toBe(false);
    expect(reactionStore.get(ARTIFACT.type, ARTIFACT.id)!.selectedStance).toBe('negative');
  });

  it('treats a side recorded on a previous visit as already chosen', async () => {
    const snapshot = reactionStore.getSnapshot();
    delete snapshot[artifactKey(ARTIFACT.type, ARTIFACT.id)];
    reactionStore.hydrate([
      {
        totals: { ...emptyTotals(ARTIFACT.type, ARTIFACT.id), medalTotal: 9, positiveOpinionTotal: 1 },
        contribution: { rottenEggCount: 0, medalCount: 9, stance: 'positive' },
      },
    ]);
    await settle();

    expect(reactionStore.get(ARTIFACT.type, ARTIFACT.id)!.selectedStance).toBe('positive');
  });
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

  it('refuses the opposite side once a side is taken, and moves nothing', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    reactionStore.setAuthenticated(true);

    reactionStore.react(ARTIFACT.type, ARTIFACT.id, 'rotten_egg', 1);
    const crossing = reactionStore.react(ARTIFACT.type, ARTIFACT.id, 'medal', 1);

    expect(crossing).toBe(false);

    const state = reactionStore.get(ARTIFACT.type, ARTIFACT.id)!;
    expect(state.totals.medalTotal).toBe(40);
    expect(state.totals.positiveOpinionTotal).toBe(0);
    expect(state.totals.negativeOpinionTotal).toBe(1);
    expect(state.contribution.medalCount).toBe(0);
    expect(state.contribution.stance).toBe('negative');
    expect(state.totals.uniqueParticipantTotal).toBe(1);
  });

  it('counts the person once in the contributor total, however many taps', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    reactionStore.setAuthenticated(true);

    for (let index = 0; index < 40; index += 1) {
      reactionStore.react(ARTIFACT.type, ARTIFACT.id, 'rotten_egg', 1);
    }

    const state = reactionStore.get(ARTIFACT.type, ARTIFACT.id)!;
    expect(state.totals.rottenEggTotal).toBe(140);
    // Forty taps, one head. The optimistic update must agree with what the
    // server will do, or the number would jump when the batch lands.
    expect(state.totals.rottenEggContributorTotal).toBe(1);
    expect(state.totals.medalContributorTotal).toBe(0);
  });

  it('reconciles against the server’s authoritative contributor counts', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        totals: {
          ...emptyTotals(ARTIFACT.type, ARTIFACT.id),
          rottenEggTotal: 105,
          medalTotal: 40,
          negativeOpinionTotal: 3,
          rottenEggContributorTotal: 3,
        },
        contribution: { rottenEggCount: 5, medalCount: 0, stance: 'negative' },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    reactionStore.setAuthenticated(true);

    for (let index = 0; index < 5; index += 1) {
      reactionStore.react(ARTIFACT.type, ARTIFACT.id, 'rotten_egg', 1);
    }
    await new Promise((resolve) => setTimeout(resolve, 700));

    const state = reactionStore.get(ARTIFACT.type, ARTIFACT.id)!;
    // Two other people were behind the rest of that total; the optimistic
    // guess of one is replaced rather than added to.
    expect(state.totals.rottenEggContributorTotal).toBe(3);
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
