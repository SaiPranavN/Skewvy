'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Turnstile } from './Turnstile';
import { TextField, PinField, FormError, FormNotice, SubmitButton } from './fields';
import { reactionStore } from '@/lib/client/reaction-store';
import { PIN_MIN_LENGTH } from '@/lib/validation/schemas';

interface ApiFailure {
  error: string;
  message: string;
  fields?: Record<string, string>;
  retryAfterSeconds?: number;
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

export interface AuthFormProps {
  siteKey: string;
  /** Development-only: skip the widget when the robot check is bypassed. */
  turnstileDisabled?: boolean;
  redirectTo?: string;
  /** Called after a session exists, before navigation. */
  onAuthenticated?: () => void;
  compact?: boolean;
}

/**
 * The robot check. In development the check can be bypassed
 * (TURNSTILE_DISABLED=1), in which case a clearly-labelled placeholder stands in
 * — the server still refuses the bypass whenever NODE_ENV is production.
 */
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

/** Applies taps that were held while the person was signed out. */
function applyPendingReactions(): number {
  const pending = reactionStore.pendingAnonymousReactions();
  const count = pending.reduce((sum, item) => sum + item.quantity, 0);
  reactionStore.flushAfterAuthentication();
  return count;
}

export function LoginForm({ siteKey, turnstileDisabled, redirectTo, onAuthenticated, compact }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setFieldErrors({});

    if (!token) {
      setError('Complete the robot check before continuing.');
      return;
    }

    setPending(true);
    try {
      const result = await postJson('/api/auth/login', { email, pin, turnstileToken: token, redirectTo });
      const data = result.data as ApiFailure & { status?: string; redirectTo?: string };

      if (!result.ok) {
        setFieldErrors(data.fields ?? {});
        setError(data.message ?? 'Something went wrong. Try again.');
        setToken(null);
        return;
      }

      if (data.status === 'step_up_required') {
        setNotice(
          'We did not recognise this device. Check your email and open the confirmation link — you will not need to do this next time.',
        );
        return;
      }
      if (data.status === 'verification_required') {
        setNotice('Confirm your email address first. We have sent you a fresh link.');
        return;
      }

      const applied = applyPendingReactions();
      onAuthenticated?.();
      router.refresh();
      if (!compact) router.push(data.redirectTo || redirectTo || '/');
      if (applied > 0) setNotice(`Signed in. Adding your ${applied} held reactions.`);
    } catch {
      setError('We could not reach Skewvy. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={error} />
      <FormNotice message={notice} />

      <TextField
        id="login-email"
        label="Email address"
        type="email"
        autoComplete="email"
        required
        value={email}
        error={fieldErrors.email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
      />

      <PinField
        id="login-pin"
        label="PIN"
        autoComplete="current-password"
        required
        value={pin}
        error={fieldErrors.pin}
        onChange={(event) => setPin(event.target.value)}
        placeholder="Your PIN"
      />

      <RobotCheck siteKey={siteKey} disabled={turnstileDisabled} action="login" onToken={setToken} />

      <SubmitButton pending={pending}>Continue</SubmitButton>

      <div className="flex items-center justify-between text-sm">
        <Link href="/auth/reset-pin" className="text-haze transition-colors hover:text-chalk">
          Forgot PIN?
        </Link>
        <Link
          href={redirectTo ? `/register?redirectTo=${encodeURIComponent(redirectTo)}` : '/register'}
          className="font-medium text-chalk-dim transition-colors hover:text-chalk"
        >
          Create an account
        </Link>
      </div>
    </form>
  );
}

export function RegisterForm({ siteKey, turnstileDisabled, redirectTo, compact }: AuthFormProps) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!token) {
      setError('Complete the robot check before continuing.');
      return;
    }

    setPending(true);
    try {
      const result = await postJson('/api/auth/register', {
        displayName,
        email,
        pin,
        confirmPin,
        turnstileToken: token,
        redirectTo,
      });
      const data = result.data as ApiFailure;

      if (!result.ok) {
        setFieldErrors(data.fields ?? {});
        setError(data.message ?? 'Something went wrong. Try again.');
        setToken(null);
        return;
      }

      setSent(true);
    } catch {
      setError('We could not reach Skewvy. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    setResendPending(true);
    setResendNotice(null);
    const result = await postJson('/api/auth/resend-verification', { email });
    const data = result.data as ApiFailure;
    setResendNotice(
      result.ok ? 'Link sent. Check your inbox.' : data.message ?? 'Wait a moment before asking for another link.',
    );
    setResendPending(false);
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
            If that address can be used, a one-time confirmation link is on its way to{' '}
            <span className="text-chalk-dim">{email}</span>. Open it once and you are in — after that you sign in with
            your email and PIN.
          </p>
        </div>

        <FormNotice message={resendNotice} />

        <button
          type="button"
          onClick={resend}
          disabled={resendPending}
          className="w-full rounded-xl border border-white/14 px-4 py-3 text-sm font-medium text-chalk-dim transition-colors hover:border-white/28 disabled:opacity-60"
        >
          {resendPending ? 'Sending…' : 'Resend the link'}
        </button>

        <p className="text-center text-xs text-haze-dim">
          Links expire after 60 minutes. You can ask for a new one every few minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={error} />

      <TextField
        id="register-name"
        label="Display name"
        autoComplete="nickname"
        required
        value={displayName}
        error={fieldErrors.displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        placeholder="What the crowd sees"
      />

      <TextField
        id="register-email"
        label="Email address"
        type="email"
        autoComplete="email"
        required
        value={email}
        error={fieldErrors.email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        hint="Confirmed once, then never needed to sign in again."
      />

      <PinField
        id="register-pin"
        label="Create PIN"
        autoComplete="new-password"
        required
        value={pin}
        error={fieldErrors.pin}
        onChange={(event) => setPin(event.target.value)}
        hint={`At least ${PIN_MIN_LENGTH} characters. Digits, letters or both — not a repeated or sequential run.`}
      />

      <PinField
        id="register-confirm-pin"
        label="Confirm PIN"
        autoComplete="new-password"
        required
        value={confirmPin}
        error={fieldErrors.confirmPin}
        onChange={(event) => setConfirmPin(event.target.value)}
      />

      <RobotCheck siteKey={siteKey} disabled={turnstileDisabled} action="register" onToken={setToken} />

      <SubmitButton pending={pending}>Continue</SubmitButton>

      {!compact && (
        <p className="text-center text-sm text-haze">
          Already have an account?{' '}
          <Link
            href={redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : '/login'}
            className="font-medium text-chalk-dim hover:text-chalk"
          >
            Log in
          </Link>
        </p>
      )}
    </form>
  );
}
