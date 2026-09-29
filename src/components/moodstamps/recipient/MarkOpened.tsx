'use client';

import { useEffect } from 'react';

/**
 * Tells Skewvy the stamp was opened — from the browser, once it has actually
 * rendered, so a mail scanner fetching the link does not count as the
 * recipient. Nothing is shown, and a failure changes nothing on the page.
 */
export function MarkOpened({ token }: { token: string }) {
  useEffect(() => {
    void fetch('/api/moodstamps/open', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      keepalive: true,
    }).catch(() => undefined);
  }, [token]);

  return null;
}
