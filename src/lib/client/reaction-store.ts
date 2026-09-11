'use client';

import type { ArtifactTotals, ArtifactType, ReactionType, UserContribution } from '@/lib/domain/types';

/**
 * Client-side reaction engine.
 *
 * Priorities, in order:
 *  1. The visible counter moves in the same frame as the tap. Always.
 *  2. Taps are batched into one request roughly every 400ms, never one per tap.
 *  3. A batch carries a client-generated id, so a retry can never double-count.
 *  4. The server's authoritative totals win on every reply.
 *
 * State lives outside React and is read through `useSyncExternalStore`, so a
 * burst of taps never triggers a burst of re-renders across the page.
 */

export const BATCH_INTERVAL_MS = 400;
const MAX_BATCH_QUANTITY = 250;
const RETRY_DELAYS_MS = [1200, 3000, 8000];

export interface ArtifactState {
  totals: ArtifactTotals;
  contribution: UserContribution;
  /** Taps not yet acknowledged by the server. */
  pendingRottenEggs: number;
  pendingMedals: number;
  /** Set while a batch is being retried, so the UI can show a quiet retry state. */
  syncState: 'idle' | 'syncing' | 'retrying' | 'offline';
  lastRemote: { reactionType: ReactionType; quantity: number; at: number } | null;
}

export interface PendingReaction {
  artifactType: ArtifactType;
  artifactId: string;
  reactionType: ReactionType;
  quantity: number;
}

type Snapshot = Record<string, ArtifactState>;

interface QueuedBatch {
  clientBatchId: string;
  artifactType: ArtifactType;
  artifactId: string;
  reactionType: ReactionType;
  quantity: number;
  attempts: number;
}

export function artifactKey(artifactType: ArtifactType, artifactId: string): string {
  return `${artifactType}:${artifactId}`;
}

function emptyContribution(): UserContribution {
  return { rottenEggCount: 0, medalCount: 0, stance: null };
}

class ReactionStore {
  private state: Snapshot = {};
  private listeners = new Set<() => void>();
  /** Accumulates taps between flushes, keyed by artifact + reaction type. */
  private buffer = new Map<string, PendingReaction>();
  private queue: QueuedBatch[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private sending = false;
  private authenticated = false;
  private onAuthRequired: (() => void) | null = null;

  /* ------------------------------ subscription ----------------------------- */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): Snapshot => this.state;

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private patch(key: string, changes: Partial<ArtifactState>): void {
    const current = this.state[key];
    if (!current) return;
    this.state = { ...this.state, [key]: { ...current, ...changes } };
    this.emit();
  }

  /* -------------------------------- lifecycle ------------------------------ */

  setAuthenticated(value: boolean): void {
    this.authenticated = value;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  setAuthRequiredHandler(handler: (() => void) | null): void {
    this.onAuthRequired = handler;
  }

  /** Seeds server-rendered state. Existing optimistic values are preserved. */
  hydrate(artifacts: Array<{ totals: ArtifactTotals; contribution?: UserContribution | null }>): void {
    let changed = false;
    const next = { ...this.state };

    for (const artifact of artifacts) {
      const key = artifactKey(artifact.totals.artifactType, artifact.totals.artifactId);
      if (next[key]) continue;
      next[key] = {
        totals: artifact.totals,
        contribution: artifact.contribution ?? emptyContribution(),
        pendingRottenEggs: 0,
        pendingMedals: 0,
        syncState: 'idle',
        lastRemote: null,
      };
      changed = true;
    }

    if (changed) {
      this.state = next;
      // Hydration can run during render, so the notification is deferred to a
      // microtask — updating subscribers mid-render is not safe.
      queueMicrotask(() => this.emit());
    }
  }

  get(artifactType: ArtifactType, artifactId: string): ArtifactState | undefined {
    return this.state[artifactKey(artifactType, artifactId)];
  }

  /* --------------------------------- tapping -------------------------------- */

  /**
   * Records one tap. The counter moves immediately; the network catches up.
   * Returns false when nothing was recorded because sign-in is required.
   */
  react(artifactType: ArtifactType, artifactId: string, reactionType: ReactionType, quantity = 1): boolean {
    const key = artifactKey(artifactType, artifactId);
    const current = this.state[key];
    if (!current) return false;

    // A signed-out tap changes nothing. The public counter only ever moves for
    // a reaction that will actually be recorded, so the number on screen is
    // never something the person cannot back up with an account.
    if (!this.authenticated) {
      this.onAuthRequired?.();
      return false;
    }

    const isEgg = reactionType === 'rotten_egg';
    const stance = isEgg ? 'negative' : 'positive';
    const previousStance = current.contribution.stance;

    // Opinion counts track people, not taps: they only move when this person's
    // single stance actually changes.
    const opinionShift = { positive: 0, negative: 0 };
    if (previousStance !== stance) {
      if (previousStance === 'positive') opinionShift.positive -= 1;
      if (previousStance === 'negative') opinionShift.negative -= 1;
      if (stance === 'positive') opinionShift.positive += 1;
      else opinionShift.negative += 1;
    }
    const isNewParticipant =
      current.contribution.rottenEggCount === 0 && current.contribution.medalCount === 0 && previousStance === null;

    this.state = {
      ...this.state,
      [key]: {
        ...current,
        totals: {
          ...current.totals,
          rottenEggTotal: current.totals.rottenEggTotal + (isEgg ? quantity : 0),
          medalTotal: current.totals.medalTotal + (isEgg ? 0 : quantity),
          positiveOpinionTotal: current.totals.positiveOpinionTotal + opinionShift.positive,
          negativeOpinionTotal: current.totals.negativeOpinionTotal + opinionShift.negative,
          uniqueParticipantTotal: current.totals.uniqueParticipantTotal + (isNewParticipant ? 1 : 0),
        },
        contribution: {
          rottenEggCount: current.contribution.rottenEggCount + (isEgg ? quantity : 0),
          medalCount: current.contribution.medalCount + (isEgg ? 0 : quantity),
          stance,
        },
        pendingRottenEggs: current.pendingRottenEggs + (isEgg ? quantity : 0),
        pendingMedals: current.pendingMedals + (isEgg ? 0 : quantity),
      },
    };
    this.emit();

    const bufferKey = `${key}:${reactionType}`;
    const buffered = this.buffer.get(bufferKey);
    if (buffered) buffered.quantity += quantity;
    else this.buffer.set(bufferKey, { artifactType, artifactId, reactionType, quantity });

    this.scheduleFlush();
    return true;
  }

  /**
   * Taps that were accepted but not yet acknowledged by the server. A session
   * that expires mid-burst pushes them back here rather than dropping them.
   */
  pendingReactions(): PendingReaction[] {
    return [...this.buffer.values()].map((item) => ({ ...item }));
  }

  /** Sends anything the buffer still holds once a session exists again. */
  flushAfterAuthentication(): void {
    this.authenticated = true;
    if (this.buffer.size === 0) return;
    this.scheduleFlush(0);
  }

  discardPending(): void {
    this.buffer.clear();
  }

  private scheduleFlush(delay = BATCH_INTERVAL_MS): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.enqueueBuffered();
      void this.drainQueue();
    }, delay);
  }

  /** Moves buffered taps into immutable, id-stamped batches. */
  private enqueueBuffered(): void {
    for (const item of this.buffer.values()) {
      let remaining = item.quantity;
      while (remaining > 0) {
        const quantity = Math.min(remaining, MAX_BATCH_QUANTITY);
        remaining -= quantity;
        this.queue.push({
          clientBatchId: `${crypto.randomUUID()}`,
          artifactType: item.artifactType,
          artifactId: item.artifactId,
          reactionType: item.reactionType,
          quantity,
          attempts: 0,
        });
      }
    }
    this.buffer.clear();
  }

  /* -------------------------------- networking ------------------------------ */

  private async drainQueue(): Promise<void> {
    if (this.sending) return;
    this.sending = true;

    try {
      while (this.queue.length > 0) {
        const batch = this.queue[0];
        const key = artifactKey(batch.artifactType, batch.artifactId);
        this.patch(key, { syncState: batch.attempts > 0 ? 'retrying' : 'syncing' });

        const outcome = await this.sendBatch(batch);

        if (outcome.status === 'ok') {
          this.queue.shift();
          const state = this.state[key];
          if (state) {
            const acknowledgedEggs = batch.reactionType === 'rotten_egg' ? batch.quantity : 0;
            const acknowledgedMedals = batch.reactionType === 'medal' ? batch.quantity : 0;
            this.patch(key, {
              // Server totals are authoritative; any still-unsent taps are added
              // back on top so the counter never appears to go backwards.
              totals: this.reconcile(outcome.totals, state, acknowledgedEggs, acknowledgedMedals),
              contribution: outcome.contribution,
              pendingRottenEggs: Math.max(0, state.pendingRottenEggs - acknowledgedEggs),
              pendingMedals: Math.max(0, state.pendingMedals - acknowledgedMedals),
              syncState: 'idle',
            });
          }
          continue;
        }

        if (outcome.status === 'unauthenticated') {
          // Put the contribution back in the buffer so nothing is lost.
          this.authenticated = false;
          this.buffer.set(`${key}:${batch.reactionType}`, {
            artifactType: batch.artifactType,
            artifactId: batch.artifactId,
            reactionType: batch.reactionType,
            quantity: (this.buffer.get(`${key}:${batch.reactionType}`)?.quantity ?? 0) + batch.quantity,
          });
          this.queue.shift();
          this.patch(key, { syncState: 'idle' });
          this.onAuthRequired?.();
          continue;
        }

        if (outcome.status === 'fatal') {
          this.queue.shift();
          this.patch(key, { syncState: 'idle' });
          continue;
        }

        batch.attempts += 1;
        if (batch.attempts > RETRY_DELAYS_MS.length) {
          // Give up on the wire but keep the local number: the next successful
          // batch reconciles against the server and corrects the display.
          this.queue.shift();
          this.patch(key, { syncState: 'offline' });
          continue;
        }

        this.patch(key, { syncState: 'retrying' });
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[batch.attempts - 1]));
      }
    } finally {
      this.sending = false;
      if (this.buffer.size > 0 && this.authenticated) this.scheduleFlush();
    }
  }

  private reconcile(
    serverTotals: ArtifactTotals,
    state: ArtifactState,
    acknowledgedEggs: number,
    acknowledgedMedals: number,
  ): ArtifactTotals {
    const stillPendingEggs = Math.max(0, state.pendingRottenEggs - acknowledgedEggs);
    const stillPendingMedals = Math.max(0, state.pendingMedals - acknowledgedMedals);
    return {
      ...serverTotals,
      rottenEggTotal: serverTotals.rottenEggTotal + stillPendingEggs,
      medalTotal: serverTotals.medalTotal + stillPendingMedals,
    };
  }

  private async sendBatch(batch: QueuedBatch): Promise<
    | { status: 'ok'; totals: ArtifactTotals; contribution: UserContribution }
    | { status: 'retry' }
    | { status: 'fatal' }
    | { status: 'unauthenticated' }
  > {
    try {
      const response = await fetch('/api/reactions/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          artifactType: batch.artifactType,
          artifactId: batch.artifactId,
          reactionType: batch.reactionType,
          quantity: batch.quantity,
          clientBatchId: batch.clientBatchId,
        }),
      });

      if (response.status === 401) return { status: 'unauthenticated' };
      if (response.status === 429 || response.status >= 500) return { status: 'retry' };
      if (!response.ok) return { status: 'fatal' };

      const data = (await response.json()) as { totals: ArtifactTotals; contribution: UserContribution };
      return { status: 'ok', totals: data.totals, contribution: data.contribution };
    } catch {
      return { status: 'retry' };
    }
  }

  /* -------------------------------- realtime -------------------------------- */

  /** Remote crowd activity. Totals move; no particle is spawned per remote tap. */
  applyRemote(event: {
    artifactType: ArtifactType;
    artifactId: string;
    reactionType: ReactionType;
    quantity: number;
    totals: ArtifactTotals;
  }): void {
    const key = artifactKey(event.artifactType, event.artifactId);
    const state = this.state[key];
    if (!state) return;

    this.patch(key, {
      totals: this.reconcile(event.totals, state, 0, 0),
      lastRemote: { reactionType: event.reactionType, quantity: event.quantity, at: Date.now() },
    });
  }

  /** Pulls authoritative totals, e.g. after returning to a backgrounded tab. */
  async refresh(artifactType: ArtifactType, artifactId: string): Promise<void> {
    try {
      const response = await fetch(`/api/artifacts/${artifactType}/${artifactId}/totals`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { totals: ArtifactTotals; contribution: UserContribution | null };
      const key = artifactKey(artifactType, artifactId);
      const state = this.state[key];
      if (!state) return;
      this.patch(key, {
        totals: this.reconcile(data.totals, state, 0, 0),
        contribution: data.contribution ?? state.contribution,
      });
    } catch {
      // Offline: keep showing the optimistic numbers.
    }
  }
}

const globalForStore = globalThis as unknown as { __skewvyReactionStore?: ReactionStore };
export const reactionStore: ReactionStore = (globalForStore.__skewvyReactionStore ??= new ReactionStore());
