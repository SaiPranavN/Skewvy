'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Turnstile } from './Turnstile';
import { TextField, PinField, FormError, FormNotice, SubmitButton } from './fields';
import { PIN_MIN_LENGTH } from '@/lib/validation/schemas';

interface ApiFailure {
  error?: string;
  message?: string;
  fields?: Record<string, string>;
}

/**
 * Two modes in one page: requesting a reset link, and — when arriving from that
 * link — choosing the new PIN. Neither branch reveals whether an address has an
 * account.
 */
export function ResetPinFlow({
  siteKey,
  turnstileDisabled,
  token,
}: {
  siteKey: string;
  turnstileDisabled?: boolean;
  token: string | null;
}) {
  return token ? (
    <ChooseNewPin siteKey={siteKey} turnstileDisabled={turnstileDisabled} token={token} />
  ) : (
    <RequestResetLink siteKey={siteKey} turnstileDisabled={turnstileDisabled} />
  );
}

/** Development-only bypass placeholder; the server rejects it in production. */
function RobotCheck({
  siteKey,
  disabled,
  action,
  onToken,
}: {
  siteKey: string;
  disabled?: boolean;
  action: string;
  onToken: (token: string | null) => void;
}) {
  useEffect(() => {
    if (disabled) onToken('development-bypass');
  }, [disabled, onToken]);

  if (disabled) {
    return (
      <p className="rounded-xl border border-white/12 bg-white/5 px-3 py-2.5 text-xs text-haze-dim">
        Robot check bypassed for local development.
      </p>
    );
  }
  return <Turnstile siteKey={siteKey} action={action} onToken={onToken} />;
}

function RequestResetLink({ siteKey, turnstileDisabled }: { siteKey: string; turnstileDisabled?: boolean }) {
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
        <div className="rounded-2xl border border-white/12 bg-white/5 p-5">
          <p className="text-2xl" aria-hidden="true">
            📮
          </p>
          <h2 className="mt-2 text-lg font-semibold text-chalk">Check your email</h2>
          <p className="mt-2 text-sm leading-relaxed text-haze">
            If that address has a verified Skewvy account, a one-click reset link is on its way. It expires in 30
            minutes and works once.
          </p>
        </div>
        <Link
          href="/login"
          className="block rounded-xl border border-white/14 px-4 py-3 text-center text-sm font-medium text-chalk-dim transition-colors hover:border-white/30"
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

      <RobotCheck siteKey={siteKey} disabled={turnstileDisabled} action="pin-reset" onToken={setTurnstileToken} />

      <SubmitButton pending={pending}>Send the reset link</SubmitButton>

      <p className="text-center text-sm text-haze">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-chalk-dim hover:text-chalk">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function ChooseNewPin({
  siteKey,
  turnstileDisabled,
  token,
}: {
  siteKey: string;
  turnstileDisabled?: boolean;
  token: string;
}) {
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
          className="block rounded-xl bg-brand px-4 py-3.5 text-center text-base font-semibold text-white transition-colors hover:bg-brand-bright"
        >
          Back to the heat
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

      <RobotCheck
        siteKey={siteKey}
        disabled={turnstileDisabled}
        action="reset-pin-confirm"
        onToken={setTurnstileToken}
      />

      <SubmitButton pending={pending}>Save new PIN</SubmitButton>

      <p className="text-xs leading-relaxed text-haze-dim">
        Saving a new PIN signs you out everywhere else, including any device you may have lost.
      </p>
    </form>
  );
}
