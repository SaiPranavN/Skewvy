'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Turnstile } from './Turnstile';
import { TextField, PinField, FormError, FormNotice, SubmitButton } from './fields';
import { PIN_MIN_LENGTH } from '@/lib/validation/schemas';

/** Mirrors the server constant; sent when the widget cannot load. */
const TURNSTILE_FALLBACK_TOKEN = 'skewvy-widget-unavailable';

interface ApiFailure {
  error?: string;
  message?: string;
  fields?: Record<string, string>;
}

interface RobotCheckConfig {
  siteKey: string;
  turnstileDisabled?: boolean;
  turnstileRequired?: boolean;
}

/**
 * Two modes in one page: requesting the reset link, and — when arriving from
 * that link — choosing the new PIN. Neither branch reveals whether an address
 * has an account.
 */
export function ResetPinFlow({ token, ...config }: RobotCheckConfig & { token: string | null }) {
  return token ? <ChooseNewPin token={token} {...config} /> : <RequestResetLink {...config} />;
}

function RobotCheck({
  siteKey,
  turnstileDisabled,
  turnstileRequired,
  action,
  onToken,
}: RobotCheckConfig & { action: string; onToken: (token: string | null) => void }) {
  useEffect(() => {
    if (turnstileDisabled) onToken('development-bypass');
  }, [turnstileDisabled, onToken]);

  const handleUnavailable = useCallback(() => {
    if (!turnstileRequired) onToken(TURNSTILE_FALLBACK_TOKEN);
  }, [onToken, turnstileRequired]);

  if (turnstileDisabled) {
    return (
      <p className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-elevated px-3.5 py-2.5 text-xs text-tertiary">
        Robot check bypassed for local development.
      </p>
    );
  }

  return <Turnstile siteKey={siteKey} action={action} onToken={onToken} onUnavailable={handleUnavailable} />;
}

function RequestResetLink(config: RobotCheckConfig) {
  const [email, setEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!turnstileToken) {
      setError('Complete the robot check before continuing.');
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/auth/request-pin-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken }),
      });
      const data = (await response.json().catch(() => ({}))) as ApiFailure;

      if (!response.ok) {
        setError(data.message ?? 'Try again in a moment.');
        setTurnstileToken(null);
        return;
      }
      setSent(true);
    } catch {
      setError('We could not reach Skewvy. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-medium text-primary">Check your email</h2>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            If that address has a verified account, a one-click reset link is on its way. It works once and expires in
            30 minutes.
          </p>
        </div>
        <Link
          href="/login"
          className="flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-default)] px-4 py-2.5 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)]"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={error} />

      <TextField
        id="reset-email"
        label="Email address"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
      />

      <RobotCheck {...config} action="pin-reset" onToken={setTurnstileToken} />

      <SubmitButton pending={pending}>Send reset link</SubmitButton>

      <p className="text-sm text-tertiary">
        Remembered it?{' '}
        <Link href="/login" className="text-secondary transition-colors duration-150 hover:text-primary">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function ChooseNewPin({ token, ...config }: RobotCheckConfig & { token: string }) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!turnstileToken) {
      setError('Complete the robot check before continuing.');
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/auth/reset-pin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, pin, confirmPin, turnstileToken }),
      });
      const data = (await response.json().catch(() => ({}))) as ApiFailure;

      if (!response.ok) {
        setFieldErrors(data.fields ?? {});
        setError(data.message ?? 'That did not work. Ask for a fresh link.');
        setTurnstileToken(null);
        return;
      }

      setDone(true);
      router.refresh();
    } catch {
      setError('We could not reach Skewvy. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4">
        <FormNotice message="New PIN saved. Every other session has been signed out." />
        <Link
          href="/"
          className="flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] bg-primary px-4 py-2.5 text-sm font-medium text-ground transition-opacity duration-150 hover:opacity-90"
        >
          Continue
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={error} />

      <PinField
        id="new-pin"
        label="New PIN"
        autoComplete="new-password"
        required
        value={pin}
        error={fieldErrors.pin}
        onChange={(event) => setPin(event.target.value)}
        hint={`At least ${PIN_MIN_LENGTH} characters.`}
      />

      <PinField
        id="confirm-new-pin"
        label="Confirm new PIN"
        autoComplete="new-password"
        required
        value={confirmPin}
        error={fieldErrors.confirmPin}
        onChange={(event) => setConfirmPin(event.target.value)}
      />

      <RobotCheck {...config} action="reset-pin-confirm" onToken={setTurnstileToken} />

      <SubmitButton pending={pending}>Save new PIN</SubmitButton>
    </form>
  );
}
