import { isTransactionPooler, resolveSsl, withoutSslMode } from '@/lib/db/postgres';
import type { ArtifactTotals, ArtifactType, ReactionType } from '@/lib/domain/types';

export interface ArtifactEvent {
  artifactType: ArtifactType;
  artifactId: string;
  reactionType: ReactionType;
  quantity: number;
  totals: ArtifactTotals;
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
  __skewvyOrigin?: string;
};

/*
 * Identifies this process on the wire. An instance that publishes an event
 * hands it to its own listeners immediately and also puts it on the channel for
 * everyone else — so without this it would receive its own event back and show
 * the crowd pulse twice for a single reaction.
 */
globalForBus.__skewvyOrigin ??= `${process.pid}-${Math.random().toString(36).slice(2, 10)}`;

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

/**
 * `LISTEN` holds a connection open for the life of the process, which a
 * transaction-mode pooler cannot provide — it hands the server connection back
 * after every statement, so the listener would never receive anything. Session
 * mode (port 5432) or a direct connection is required, and `REALTIME_DATABASE_URL`
 * exists so the relay can use one while ordinary queries keep using the pooler.
 */
function relayConnectionString(): string | null {
  const url = process.env.REALTIME_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || '';
  return /^postgres/.test(url) ? url : null;
}

function pgRelayEnabled(): boolean {
  return process.env.REALTIME_PG_NOTIFY === '1' && relayConnectionString() !== null;
}

async function relayToPostgres(event: ArtifactEvent): Promise<void> {
  if (!pgRelayEnabled()) return;
  try {
    const { execute } = await import('@/lib/db');
    // NOTIFY is fine through the transaction pooler: it commits with the
    // statement. Only LISTEN needs a connection that outlives one.
    await execute('SELECT pg_notify($1, $2)', [
      'skewvy_reactions',
      JSON.stringify({ ...event, origin: globalForBus.__skewvyOrigin }),
    ]);
  } catch {
    // Realtime is best-effort; totals stay correct without it.
  }
}

const RELAY_RETRY_MS = 5_000;

/**
 * Opens a dedicated LISTEN connection once per process when enabled, and keeps
 * it open.
 *
 * A long-lived connection will be dropped eventually — a pooler recycling it, a
 * deploy on the database side, a network blip — and without reconnection
 * realtime would go quiet for the life of the process while everything else
 * carried on working, which is the kind of failure nobody notices for a week.
 */
function ensurePostgresRelay(): void {
  if (!pgRelayEnabled() || globalForBus.__skewvyPgRelay) return;

  const connectionString = relayConnectionString()!;
  if (isTransactionPooler(connectionString)) {
    console.warn(
      '[realtime] REALTIME_PG_NOTIFY is on but the connection is a transaction-mode pooler (port 6543), ' +
        'which cannot hold a LISTEN. Set REALTIME_DATABASE_URL to a session-mode connection (port 5432).',
    );
    return;
  }

  globalForBus.__skewvyPgRelay = (async () => {
    const { Client } = await import('pg');

    const connect = async (): Promise<void> => {
      const client = new Client({
        connectionString: withoutSslMode(connectionString),
        application_name: 'skewvy-realtime',
        ssl: resolveSsl(connectionString),
      });

      const reconnect = () => {
        client.removeAllListeners();
        setTimeout(() => void connect().catch(() => scheduleRetry()), RELAY_RETRY_MS);
      };
      const scheduleRetry = () => setTimeout(() => void connect().catch(() => scheduleRetry()), RELAY_RETRY_MS);

      // Without a listener here, a dropped connection raises an unhandled
      // 'error' event and takes the process with it.
      client.on('error', reconnect);
      client.on('end', reconnect);

      // Inbound events go straight to local listeners, so relaying never loops.
      client.on('notification', (message) => {
        if (!message.payload) return;
        try {
          const event = JSON.parse(message.payload) as ArtifactEvent & { origin?: string };
          if (event.origin === globalForBus.__skewvyOrigin) return;
          for (const listener of listeners()) listener(event);
        } catch {
          // Ignore malformed payloads.
        }
      });

      await client.connect();
      await client.query('LISTEN skewvy_reactions');
    };

    await connect();
  })().catch((error: Error) => {
    console.warn(`[realtime] relay unavailable: ${error.message}`);
    globalForBus.__skewvyPgRelay = undefined;
  });
}
