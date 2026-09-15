'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Turnstile } from './Turnstile';
import { TextField, PinField, FormError, FormNotice, SubmitButton } from './fields';
import { reactionStore } from '@/lib/client/reaction-store';
import { PIN_MIN_LENGTH } from '@/lib/validation/schemas';

/** Mirrors the server constant; sent when the widget cannot load. */
const TURNSTILE_FALLBACK_TOKEN = 'skewvy-widget-unavailable';

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
  /**
   * True once real Turnstile keys are configured. Until then a browser that
   * cannot load the widget falls back rather than being locked out.
   */
  turnstileRequired?: boolean;
  /** True when sign-up ends at an emailed link rather than a live session. */
  emailVerificationRequired?: boolean;
  redirectTo?: string;
  onAuthenticated?: () => void;
  compact?: boolean;
}

/**
 * The robot check.
 *
 * Three states, in order of preference: the real widget; a clearly-labelled
 * bypass in development; and a fallback when the widget cannot load and no real
 * keys are configured — the server rejects that fallback the moment keys exist.
 */
function RobotCheck({
  siteKey,
  disabled,
  required,
  action,
  onToken,
}: {
  siteKey: string;
  disabled?: boolean;
  required?: boolean;
  action: string;
  onToken: (token: string | null) => void;
}) {
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (disabled) onToken('development-bypass');
  }, [disabled, onToken]);

  const handleUnavailable = useCallback(() => {
    setUnavailable(true);
    if (!required) onToken(TURNSTILE_FALLBACK_TOKEN);
  }, [onToken, required]);

  if (disabled) {
    return (
      <p className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-elevated px-3.5 py-2.5 text-xs text-tertiary">
        Robot check bypassed for local development.
      </p>
    );
  }

  return (
    <div>
      <Turnstile siteKey={siteKey} action={action} onToken={onToken} onUnavailable={handleUnavailable} />
      {unavailable && !required && (
        <p className="mt-1.5 text-xs text-tertiary">Continuing without it — no site key is configured yet.</p>
      )}
      {unavailable && required && (
        <p className="mt-1.5 text-xs text-error">
          The robot check is required. Disable blocking extensions or try another browser.
        </p>
      )}
    </div>
  );
}


/**
 * Leaves the auth screen once a session cookie exists.
 *
 * A client-side `router.push` can serve an RSC payload that was rendered before
 * the cookie was set, landing the person on a page that still says "Sign in".
 * A real navigation guarantees the server renders with the new session. Inside
 * the sheet we stay put and just refresh, which keeps the page underneath.
 */
function completeAuth({
  compact,
  target,
  refresh,
  onAuthenticated,
}: {
  compact?: boolean;
  target: string;
  refresh: () => void;
  onAuthenticated?: () => void;
}): void {
  reactionStore.flushAfterAuthentication();
  onAuthenticated?.();

  if (compact) {
    refresh();
    return;
  }
  window.location.assign(target);
}

export function LoginForm({
  siteKey,
  turnstileDisabled,
  turnstileRequired,
  redirectTo,
  onAuthenticated,
  compact,
}: AuthFormProps) {
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
          'We did not recognise this device. Open the confirmation link in your email — you will not need to do this next time.',
        );
        return;
      }
      if (data.status === 'verification_required') {
        setNotice('Confirm your email address first. We have sent a fresh link.');
        return;
      }

      completeAuth({
        compact,
        target: data.redirectTo || redirectTo || '/',
        refresh: router.refresh,
        onAuthenticated,
      });
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
      />

      <RobotCheck
        siteKey={siteKey}
        disabled={turnstileDisabled}
        required={turnstileRequired}
        action="login"
        onToken={setToken}
      />

      <SubmitButton pending={pending}>Sign in</SubmitButton>

      <div className="flex items-center justify-between gap-4 text-sm">
        <Link href="/auth/reset-pin" className="text-tertiary transition-colors duration-150 hover:text-primary">
          Forgot PIN?
        </Link>
        <Link
          href={redirectTo ? `/register?redirectTo=${encodeURIComponent(redirectTo)}` : '/register'}
          className="text-secondary transition-colors duration-150 hover:text-primary"
        >
          Create an account
        </Link>
      </div>
    </form>
  );
}

/**
 * Step one of sign-up: a name and an address.
 *
 * No PIN here. The address is proved first, and the PIN is chosen on the other
 * side of the emailed link — so a PIN is never stored against an address
 * nobody has shown they control.
 */
export function RegisterForm({
  siteKey,
  turnstileDisabled,
  turnstileRequired,
  emailVerificationRequired = true,
  redirectTo,
  compact,
}: AuthFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
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
        turnstileToken: token,
        redirectTo,
      });
      const data = result.data as ApiFailure & { status?: string; token?: string };

      if (!result.ok) {
        setFieldErrors(data.fields ?? {});
        setError(data.message ?? 'Something went wrong. Try again.');
        setToken(null);
        return;
      }

      if (data.status === 'account_exists') {
        setFieldErrors({ email: 'That address already has an account.' });
        setError('You already have an account with that email. Sign in instead.');
        setToken(null);
        return;
      }

      // No mail transport, so there is no inbox to wait on: go straight to the
      // step the link would have opened. Production always sends the email.
      if (data.status === 'ready_for_pin' && data.token) {
        const next = new URLSearchParams({ token: data.token });
        if (redirectTo) next.set('redirectTo', redirectTo);
        router.push(`/auth/complete?${next.toString()}`);
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
      result.ok ? 'Link sent. Check your inbox.' : (data.message ?? 'Wait a moment before asking for another link.'),
    );
    setResendPending(false);
  };

  if (sent) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-medium text-primary">Check your email</h2>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            A confirmation link is on its way to <span className="text-primary">{email}</span>. Open it to choose your
            PIN and finish setting up the account.
          </p>
        </div>

        <ol className="space-y-2 text-sm text-tertiary">
          <li>
            <span className="text-secondary">1.</span> Name and email — done
          </li>
          <li>
            <span className="text-primary">2. Confirm your email</span> — open the link we just sent
          </li>
          <li>
            <span className="text-secondary">3.</span> Choose a PIN and finish
          </li>
        </ol>

        <FormNotice message={resendNotice} />

        <button
          type="button"
          onClick={resend}
          disabled={resendPending}
          className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-default)] px-4 py-2.5 text-sm text-primary transition-colors duration-150 hover:border-[var(--border-strong)] disabled:opacity-50"
        >
          {resendPending ? 'Sending…' : 'Resend the link'}
        </button>

        <p className="text-xs text-tertiary">Links expire after 60 minutes.</p>
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
        hint="Shown next to your comments. Not your email address."
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
        hint={
          emailVerificationRequired
            ? 'We send one link here. You choose your PIN after opening it.'
            : 'Used to sign in. No confirmation email is sent.'
        }
      />

      <RobotCheck
        siteKey={siteKey}
        disabled={turnstileDisabled}
        required={turnstileRequired}
        action="register"
        onToken={setToken}
      />

      <SubmitButton pending={pending}>Continue</SubmitButton>

      {!compact && (
        <p className="text-sm text-tertiary">
          Already have an account?{' '}
          <Link
            href={redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : '/login'}
            className="text-secondary transition-colors duration-150 hover:text-primary"
          >
            Sign in
          </Link>
        </p>
      )}
    </form>
  );
}

/**
 * Step two: the address is proved, so the PIN can be set and the account made.
 *
 * Reached only through the emailed link. The token is the authority — the name
 * and address shown here came from the pending sign-up it points at, not from
 * anything the browser supplied.
 */
export function CompleteRegistrationForm({
  token,
  displayName,
  email,
  redirectTo,
  siteKey,
  turnstileDisabled,
  turnstileRequired,
}: {
  token: string;
  displayName: string;
  email: string;
  redirectTo: string | null;
  siteKey: string;
  turnstileDisabled: boolean;
  turnstileRequired: boolean;
}) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
      const result = await postJson('/api/auth/complete-registration', {
        token,
        pin,
        confirmPin,
        turnstileToken,
      });
      const data = result.data as ApiFailure & { status?: string; redirectTo?: string };

      if (!result.ok) {
        setFieldErrors(data.fields ?? {});
        setError(data.message ?? 'Something went wrong. Try again.');
        setTurnstileToken(null);
        return;
      }

      completeAuth({
        target: data.redirectTo || redirectTo || '/',
        refresh: router.refresh,
      });
    } catch {
      setError('We could not reach Skewvy. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={error} />

      <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-surface px-4 py-3">
        <p className="text-sm text-secondary">
          Confirmed as <span className="text-primary">{displayName}</span>
        </p>
        <p className="mt-0.5 text-xs text-tertiary">{email}</p>
      </div>

      <PinField
        id="complete-pin"
        label="Create PIN"
        autoComplete="new-password"
        required
        value={pin}
        error={fieldErrors.pin}
        onChange={(event) => setPin(event.target.value)}
        hint={`At least ${PIN_MIN_LENGTH} characters. Digits, letters or both. This is how you sign in from now on.`}
      />

      <PinField
        id="complete-confirm-pin"
        label="Confirm PIN"
        autoComplete="new-password"
        required
        value={confirmPin}
        error={fieldErrors.confirmPin}
        onChange={(event) => setConfirmPin(event.target.value)}
      />

      <RobotCheck
        siteKey={siteKey}
        disabled={turnstileDisabled}
        required={turnstileRequired}
        action="complete-registration"
        onToken={setTurnstileToken}
      />

      <SubmitButton pending={pending}>Finish and sign in</SubmitButton>
    </form>
  );
}
