'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Skewvy page error:', error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-24 sm:py-32">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-primary">Something went wrong</h1>
      <p className="mt-3 text-sm leading-relaxed text-secondary">
        This page failed to load. Your recorded reactions are unaffected.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-[var(--radius-control)] bg-primary px-4 py-2.5 text-sm font-medium text-ground transition-opacity duration-150 hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border-default)] px-4 py-2.5 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)]"
        >
          Home
        </Link>
      </div>
      {error.digest && <p className="mt-6 text-xs text-tertiary">Reference: {error.digest}</p>}
    </div>
  );
}
