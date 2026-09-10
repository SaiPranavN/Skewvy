'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { reactionStore } from '@/lib/client/reaction-store';

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

        // Any taps held before signing up are applied now.
        reactionStore.flushAfterAuthentication();
        setState({
          phase: 'success',
          displayName: data.user?.displayName ?? 'friend',
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
        <div className="skeleton h-6 w-40 rounded-full" />
        <div className="skeleton h-24 rounded-2xl" />
        <p className="text-sm text-haze">Checking your link…</p>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="space-y-4">
        <div role="alert" className="rounded-2xl border border-brand/35 bg-brand/12 p-5">
          <p className="text-2xl" aria-hidden="true">
            ⏳
          </p>
          <h2 className="mt-2 text-lg font-semibold text-chalk">That link is no longer usable</h2>
          <p className="mt-2 text-sm leading-relaxed text-chalk-dim">{state.message}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            href="/login"
            className="rounded-xl bg-brand px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-bright"
          >
            Sign in with your PIN
          </Link>
          <Link
            href="/auth/reset-pin"
            className="rounded-xl border border-white/14 px-4 py-3 text-center text-sm font-medium text-chalk-dim transition-colors hover:border-white/30"
          >
            Reset my PIN
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-live="polite">
      <div className="rounded-2xl border border-good/30 bg-good/10 p-5">
        <p className="text-2xl" aria-hidden="true">
          🏅
        </p>
        <h2 className="mt-2 text-lg font-semibold text-chalk">You are in, {state.displayName}</h2>
        <p className="mt-2 text-sm leading-relaxed text-chalk-dim">
          Email confirmed. From now on you sign in with your email address and PIN — no inbox required.
        </p>
      </div>

      <Link
        href={state.redirectTo}
        className="block rounded-xl bg-brand px-4 py-3.5 text-center text-base font-semibold text-white transition-colors hover:bg-brand-bright"
      >
        Enter the heat
      </Link>
    </div>
  );
}
