'use client';

import { useId, useState } from 'react';
import { PIN_MIN_LENGTH } from '@/lib/validation/schemas';

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-chalk-dim">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs text-haze-dim">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="flex items-start gap-1.5 text-xs font-medium text-brand-bright">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-white/12 bg-black/35 px-4 py-3 text-base text-chalk placeholder:text-haze-dim transition-colors focus:border-white/30 focus:outline-none';

export function TextField({
  id,
  label,
  error,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string; hint?: string }) {
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={inputClass}
        {...props}
      />
    </Field>
  );
}

/**
 * The PIN input. It is a password field, not a set of single-digit OTP boxes:
 * the PIN is a credential the person chose, and may be longer than six.
 */
export function PinField({
  id,
  label,
  error,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string; hint?: string }) {
  const [visible, setVisible] = useState(false);
  const toggleId = useId();

  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          inputMode="text"
          minLength={PIN_MIN_LENGTH}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`${inputClass} pr-20 tracking-[0.2em]`}
          {...props}
        />
        <button
          type="button"
          id={toggleId}
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-2 my-auto h-8 rounded-lg px-2.5 text-xs font-semibold text-haze transition-colors hover:text-chalk"
        >
          {visible ? 'Hide' : 'Show'}
          <span className="sr-only"> PIN</span>
        </button>
      </div>
    </Field>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-brand/35 bg-brand/12 px-4 py-3 text-sm font-medium text-chalk"
    >
      {message}
    </div>
  );
}

export function FormNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="status" className="rounded-xl border border-good/30 bg-good/10 px-4 py-3 text-sm text-chalk">
      {message}
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-60"
      {...props}
    >
      {pending && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
        />
      )}
      {children}
    </button>
  );
}
