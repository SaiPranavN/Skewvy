import type { NextRequest } from 'next/server';
import { subscribeToArtifactEvents } from '@/lib/services/realtime';
import { resumeSimulatorIfEnabled } from '@/lib/services/simulator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-sent events carrying crowd reaction updates.
 *
 * SSE rather than WebSockets: the flow is one-directional (writes go through
 * the batch endpoint), it survives proxies, and it reconnects on its own.
 * Events are coalesced per artifact over a short window so a busy artifact
 * sends a few grouped updates a second rather than one per batch.
 */
const FLUSH_INTERVAL_MS = 700;
const HEARTBEAT_MS = 25_000;

export async function GET(request: NextRequest) {
  // If the demo simulator was left on, a fresh server process restarts it here.
  await resumeSimulatorIfEnabled();

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const pending = new Map<string, { payload: string; quantity: number; reactionType: string }>();

      const send = (event: string, data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          closed = true;
        }
      };

      send('open', JSON.stringify({ ok: true }));

      const unsubscribe = subscribeToArtifactEvents((event) => {
        const key = `${event.artifactType}:${event.artifactId}:${event.reactionType}`;
        const existing = pending.get(key);
        pending.set(key, {
          reactionType: event.reactionType,
          quantity: (existing?.quantity ?? 0) + event.quantity,
          payload: JSON.stringify({
            artifactType: event.artifactType,
            artifactId: event.artifactId,
            reactionType: event.reactionType,
            totals: event.totals,
            source: event.source,
          }),
        });
      });

      const flush = setInterval(() => {
        if (pending.size === 0) return;
        for (const entry of pending.values()) {
          const parsed = JSON.parse(entry.payload) as Record<string, unknown>;
          send('reaction', JSON.stringify({ ...parsed, quantity: entry.quantity }));
        }
        pending.clear();
      }, FLUSH_INTERVAL_MS);

      const heartbeat = setInterval(() => send('ping', JSON.stringify({ at: Date.now() })), HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(flush);
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the runtime.
        }
      };

      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
