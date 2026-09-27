'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MoodStampBoardData, MoodStampBoardResult } from '@/lib/moodstamps/types';

export type BoardLoad =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'offline' }
  | { status: 'ready'; data: MoodStampBoardData };

/**
 * The board's data, kept apart from how it is drawn.
 *
 * The server renders the first copy, so a normal visit never waits on the
 * client. This takes over only when that copy could not be read, when the
 * person asks to retry, or when the connection comes back — and it reads only
 * the signed-in person's own board, from an endpoint that takes no id.
 *
 * Offline follows the rest of the site: whatever was already loaded stays on
 * screen, and a fresh load waits for the connection instead of failing.
 */
export function useMoodStampBoard(initial: MoodStampBoardResult) {
  const [load, setLoad] = useState<BoardLoad>(initial);
  const [online, setOnline] = useState(true);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    if (!navigator.onLine) {
      setLoad((current) => (current.status === 'ready' ? current : { status: 'offline' }));
      return;
    }

    inFlight.current = true;
    setLoad((current) => (current.status === 'ready' ? current : { status: 'loading' }));
    try {
      const response = await fetch('/api/moodstamps', { cache: 'no-store', credentials: 'same-origin' });
      if (response.status === 401) {
        // The session ended while the page was open.
        window.location.assign('/login?returnTo=%2Fmoodstamps');
        return;
      }
      if (!response.ok) throw new Error(`MoodStamps request failed with ${response.status}`);
      setLoad({ status: 'ready', data: (await response.json()) as MoodStampBoardData });
    } catch {
      setLoad((current) =>
        current.status === 'ready' ? current : navigator.onLine ? { status: 'error' } : { status: 'offline' },
      );
    } finally {
      inFlight.current = false;
    }
  }, []);

  const status = useRef(load.status);
  useEffect(() => {
    status.current = load.status;
  }, [load.status]);

  useEffect(() => {
    setOnline(navigator.onLine);

    const onOnline = () => {
      setOnline(true);
      // Only a board that never loaded needs fetching again.
      if (status.current === 'offline' || status.current === 'error') void refresh();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refresh]);

  return { load, online, refresh };
}
