'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { reactionStore } from '@/lib/client/reaction-store';
import { FormNotice } from './fields';

type State =
  | { phase: 'checking' }
  | { phase: 'success'; displayName: string; redirectTo: string }
  | { phase: 'error'; message: string };

/**
 * Consumes an emailed verification or step-up link. The link is single-use, so
 * this runs exactly once even under React's development double-effect.
 */
export function VerifyClient({ token, redirectTo }: { token: string | null; redirectTo: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: 'checking' });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!token) {
      setState({ phase: 'error', message: 'That link is incomplete. Ask for a fresh one from the sign-in page.' });
      return;
    }

    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          message?: string;
          user?: { displayName: string };
          redirectTo?: string;
        };

        if (!response.ok) {
          setState({ phase: 'error', message: data.message ?? 'That link did not work.' });
          return;
        }

        reactionStore.flushAfterAuthentication();
        setState({
          phase: 'success',
          displayName: data.user?.displayName ?? 'there',
          redirectTo: data.redirectTo || redirectTo || '/',
        });
        router.refresh();
      })
      .catch(() =>
        setState({ phase: 'error', message: 'We could not reach Skewvy. Check your connection and try again.' }),
      );
  }, [token, redirectTo, router]);

  if (state.phase === 'checking') {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-11 w-full" />
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="space-y-4">
        <div role="alert">
          <h2 className="text-base font-medium text-primary">That link is no longer usable</h2>
          <p className="mt-2 text-sm leading-relaxed text-secondary">{state.message}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            href="/login"
            className="flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-primary px-4 py-2.5 text-sm font-medium text-ground transition-opacity duration-150 hover:opacity-90"
          >
            Sign in
          </Link>
          <Link
            href="/auth/reset-pin"
            className="flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-default)] px-4 py-2.5 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)]"
          >
            Reset my PIN
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-live="polite">
      <FormNotice message={`Email confirmed. Welcome, ${state.displayName}.`} />
      <p className="text-sm leading-relaxed text-secondary">
        From now on you sign in with your email address and PIN — no inbox required.
      </p>
      <Link
        href={state.redirectTo}
        className="flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] bg-primary px-4 py-2.5 text-sm font-medium text-ground transition-opacity duration-150 hover:opacity-90"
      >
        Continue
      </Link>
    </div>
  );
}
