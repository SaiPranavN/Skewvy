'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile widget.
 *
 * The token this produces is only half the check — every endpoint that accepts
 * one verifies it against Cloudflare server-side before doing anything.
 *
 * The widget can fail for reasons that have nothing to do with the person using
 * it: a blocked third-party iframe, a privacy extension, a corporate proxy. If
 * it has not produced a token within `unavailableAfterMs`, `onUnavailable` is
 * called so the form can decide what to do — fall back while running on the
 * public test keys, or show a blocking error once real keys are configured.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string | undefined;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/**
 * Resolves once the Turnstile API is actually callable.
 *
 * The script tag may already be in the document from an earlier mount, in which
 * case its `load` event has long since fired — so readiness is polled rather
 * than waited on.
 */
function whenTurnstileReady(timeoutMs: number): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const check = () => {
      // `turnstile.ready` only queues callbacks registered before the API
      // finishes initialising, so a post-init call can hang. A callable
      // `render` is the reliable readiness signal.
      if (window.turnstile?.render) {
        resolve();
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('turnstile-unavailable'));
        return;
      }
      setTimeout(check, 120);
    };

    check();
  });
}

export function Turnstile({
  siteKey,
  onToken,
  onUnavailable,
  action,
  unavailableAfterMs = 6000,
  className = '',
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  /** Called once if no token has arrived within `unavailableAfterMs`. */
  onUnavailable?: () => void;
  action: string;
  unavailableAfterMs?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const solvedRef = useRef(false);

  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const describedBy = useId();

  useEffect(() => {
    let cancelled = false;
    solvedRef.current = false;

    const giveUp = () => {
      if (cancelled || solvedRef.current) return;
      setStatus('unavailable');
      onUnavailableRef.current?.();
    };

    const deadline = setTimeout(giveUp, unavailableAfterMs);

    whenTurnstileReady(unavailableAfterMs)
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        containerRef.current.innerHTML = '';
        widgetIdRef.current =
          window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            action,
            theme: 'dark',
            callback: (token: string) => {
              solvedRef.current = true;
              clearTimeout(deadline);
              setStatus('ready');
              onTokenRef.current(token);
            },
            'error-callback': giveUp,
            'expired-callback': () => {
              solvedRef.current = false;
              onTokenRef.current(null);
              if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
            },
          }) ?? null;
      })
      .catch(giveUp);

    return () => {
      cancelled = true;
      clearTimeout(deadline);
      if (widgetIdRef.current) {
        try {
          window.turnstile?.remove(widgetIdRef.current);
        } catch {
          // The widget may already be gone.
        }
      }
    };
  }, [siteKey, action, unavailableAfterMs]);

  return (
    <div className={className}>
      <div ref={containerRef} aria-describedby={describedBy} />
      <p id={describedBy} className="mt-2 text-xs text-tertiary">
        {status === 'unavailable'
          ? 'The robot check could not load in this browser.'
          : 'Protected by Cloudflare Turnstile.'}
      </p>
    </div>
  );
}
