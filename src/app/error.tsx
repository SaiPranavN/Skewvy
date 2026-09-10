'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Skewvy page error:', error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-24 text-center sm:py-32">
      <p className="emoji text-5xl" aria-hidden="true">
        🍳
      </p>
      <h1 className="mt-6 text-balance text-3xl font-black tracking-[-0.02em] text-chalk sm:text-4xl">
        Something got cooked, and it was us
      </h1>
      <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-haze">
        This page failed to load. Your reactions are safe — nothing is lost.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-bright"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-white/14 px-5 py-3 text-sm font-medium text-chalk-dim transition-colors hover:border-white/30"
        >
          Back home
        </Link>
      </div>
      {error.digest && <p className="mt-6 text-xs text-haze-dim">Reference: {error.digest}</p>}
    </div>
  );
}
