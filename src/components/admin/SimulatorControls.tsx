'use client';

import { useState, useTransition } from 'react';
import { toggleSimulatorAction, resetTotalsAction } from '@/app/admin/actions';

/**
 * Development-only demo tools. The server refuses both actions outside
 * development unless ALLOW_SIMULATOR=1 is set explicitly, so this panel can
 * never quietly generate fake activity on a production deployment.
 */
export function SimulatorControls({
  allowed,
  enabled,
  running,
}: {
  allowed: boolean;
  enabled: boolean;
  running: boolean;
}) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!allowed) {
    return (
      <section className="panel rounded-[var(--radius-card)] p-5">
        <h2 className="text-lg font-semibold text-primary">Demo tools</h2>
        <p className="mt-2 text-sm text-secondary">
          Simulated activity and total resets are disabled in this environment. They require development mode, or an
          explicit <code className="text-secondary">ALLOW_SIMULATOR=1</code>.
        </p>
      </section>
    );
  }

  const toggle = () => {
    const next = !isEnabled;
    setIsEnabled(next);
    startTransition(async () => {
      const result = await toggleSimulatorAction(next);
      setMessage(result.message ?? null);
      if (!result.ok) setIsEnabled(!next);
    });
  };

  const reset = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    setConfirmingReset(false);
    startTransition(async () => {
      const result = await resetTotalsAction();
      setMessage(result.message ?? null);
    });
  };

  return (
    <section aria-labelledby="demo-tools-heading" className="panel rounded-[var(--radius-card)] border-[var(--border-default)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="eyebrow text-warning">
            Development only
          </span>
          <h2 id="demo-tools-heading" className="mt-3 text-lg font-semibold text-primary">
            Simulated demo activity
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-secondary">
            Adds small batches of Rotten Eggs and Medals from demo accounts at irregular intervals, producing believable
            trending velocity. It writes through the same service real reactions use, so the totals stay consistent.
            Everything it creates is clearly labelled demo data.
          </p>
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          role="switch"
          aria-checked={isEnabled}
          className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-[var(--radius-control)] border px-4 py-2.5 text-sm transition-colors duration-150 disabled:opacity-50 ${
            isEnabled ? 'border-[var(--border-strong)] text-success' : 'border-[var(--border-default)] text-secondary hover:border-[var(--border-strong)]'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-full ${isEnabled ? 'animate-pulse bg-success' : 'bg-disabled'}`}
          />
          {isEnabled ? 'Running' : 'Stopped'}
        </button>
      </div>

      {isEnabled && (
        <p className="mt-4 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-surface-2 px-4 py-3 text-xs text-warning">
          ⚠ Simulated demo activity is currently adding reactions to published content.
          {running ? '' : ' The background loop restarts on the next request.'}
        </p>
      )}

      <div className="mt-5 border-t border-[var(--border-subtle)] pt-5">
        <h3 className="text-sm font-semibold text-primary">Reset demo totals</h3>
        <p className="mt-1 text-sm text-secondary">
          Deletes every reaction aggregate, opinion and batch record, then recomputes all artifact totals to zero.
          Content is left untouched.
        </p>
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className={`mt-3 rounded-[var(--radius-control)] border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
            confirmingReset
              ? 'border-[var(--border-strong)] bg-surface-2 text-brand'
              : 'border-[var(--border-default)] text-secondary hover:border-[var(--border-strong)]'
          }`}
        >
          {confirmingReset ? 'Tap again to confirm — this cannot be undone' : 'Reset all reaction data'}
        </button>
        {confirmingReset && (
          <button
            type="button"
            onClick={() => setConfirmingReset(false)}
            className="ml-2 rounded-[var(--radius-control)] px-3 py-2.5 text-sm text-secondary hover:text-primary"
          >
            Cancel
          </button>
        )}
      </div>

      <p role="status" className="mt-3 min-h-5 text-xs text-secondary">
        {message}
      </p>
    </section>
  );
}
