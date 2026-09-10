import type { ArtifactTotals, ArtifactType, ReactionType } from '@/lib/domain/types';

export interface ArtifactEvent {
  artifactType: ArtifactType;
  artifactId: string;
  reactionType: ReactionType;
  quantity: number;
  totals: ArtifactTotals;
  source: 'user' | 'simulator';
  actorId: string;
}

type Listener = (event: ArtifactEvent) => void;

/**
 * In-process fan-out feeding the SSE endpoint. Survives hot reloads by living on
 * globalThis. On a multi-instance deployment, set `REALTIME_PG_NOTIFY=1` with a
 * PostgreSQL `DATABASE_URL` to relay events between instances via LISTEN/NOTIFY.
 */
const globalForBus = globalThis as unknown as {
  __skewvyListeners?: Set<Listener>;
  __skewvyPgRelay?: Promise<void>;
};

globalForBus.__skewvyListeners ??= new Set();

function listeners(): Set<Listener> {
  return globalForBus.__skewvyListeners!;
}

export function subscribeToArtifactEvents(listener: Listener): () => void {
  listeners().add(listener);
  ensurePostgresRelay();
  return () => {
    listeners().delete(listener);
  };
}

export function publishArtifactEvent(event: ArtifactEvent): void {
  for (const listener of listeners()) {
    try {
      listener(event);
    } catch {
      // A broken subscriber must never break the write path.
    }
  }
  void relayToPostgres(event);
}

function pgRelayEnabled(): boolean {
  return process.env.REALTIME_PG_NOTIFY === '1' && /^postgres/.test(process.env.DATABASE_URL ?? '');
}

async function relayToPostgres(event: ArtifactEvent): Promise<void> {
  if (!pgRelayEnabled()) return;
  try {
    const { execute } = await import('@/lib/db');
    await execute('SELECT pg_notify($1, $2)', ['skewvy_reactions', JSON.stringify(event)]);
  } catch {
    // Realtime is best-effort; totals stay correct without it.
  }
}

/** Opens a dedicated LISTEN connection once per process when enabled. */
function ensurePostgresRelay(): void {
  if (!pgRelayEnabled() || globalForBus.__skewvyPgRelay) return;

  globalForBus.__skewvyPgRelay = (async () => {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query('LISTEN skewvy_reactions');
    // Inbound events go straight to local listeners, so relaying never loops.
    client.on('notification', (message) => {
      if (!message.payload) return;
      try {
        const event = JSON.parse(message.payload) as ArtifactEvent;
        for (const listener of listeners()) listener(event);
      } catch {
        // Ignore malformed payloads.
      }
    });
  })().catch(() => {
    globalForBus.__skewvyPgRelay = undefined;
  });
}
