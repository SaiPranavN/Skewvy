'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile widget.
 *
 * The token this produces is only half the check — every endpoint that accepts
 * one verifies it against Cloudflare server-side before doing anything.
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
 * than waited on, and `turnstile.ready` is used when the API exposes it.
 */
function whenTurnstileReady(timeoutMs = 12_000): Promise<void> {
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
  action,
  className = '',
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  action: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const describedBy = useId();

  useEffect(() => {
    let cancelled = false;

    whenTurnstileReady()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        containerRef.current.innerHTML = '';
        widgetIdRef.current =
          window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            action,
            theme: 'dark',
            callback: (token: string) => {
              setStatus('ready');
              onTokenRef.current(token);
            },
            'error-callback': () => {
              setStatus('error');
              onTokenRef.current(null);
            },
            'expired-callback': () => {
              onTokenRef.current(null);
              if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
            },
          }) ?? null;
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current) {
        try {
          window.turnstile?.remove(widgetIdRef.current);
        } catch {
          // The widget may already be gone.
        }
      }
    };
  }, [siteKey, action]);

  return (
    <div className={className}>
      <div ref={containerRef} aria-describedby={describedBy} />
      <p id={describedBy} className="mt-1.5 text-xs text-haze-dim">
        {status === 'error'
          ? 'The robot check could not load. Check your connection and try again.'
          : 'Robot check by Cloudflare Turnstile.'}
      </p>
    </div>
  );
}
