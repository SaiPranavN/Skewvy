'use client';

import { useId, useState } from 'react';
import { PIN_MIN_LENGTH } from '@/lib/validation/schemas';

const inputClass =
  'w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-elevated px-3.5 py-2.5 text-[0.9375rem] text-primary placeholder:text-disabled transition-colors duration-150 focus:border-[var(--border-strong)] focus:outline-none';

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
      <label htmlFor={htmlFor} className="block text-sm text-secondary">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs leading-relaxed text-tertiary">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}

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
 * The PIN input is a password field, not a row of single-digit boxes: the PIN
 * is a credential the person chose, and it may be longer than six characters.
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
          className={`${inputClass} pr-16 tracking-[0.12em]`}
          {...props}
        />
        <button
          type="button"
          id={toggleId}
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-1.5 my-auto h-8 rounded px-2 text-xs text-tertiary transition-colors duration-150 hover:text-primary"
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
      className="flex items-start gap-2.5 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-elevated px-3.5 py-3 text-sm text-primary"
    >
      <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-error" />
      {message}
    </div>
  );
}

export function FormNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-elevated px-3.5 py-3 text-sm text-secondary"
    >
      <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
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
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 py-2.5 text-sm font-medium text-ground transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      {...props}
    >
      {pending && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-ground/30 border-t-ground"
        />
      )}
      {children}
    </button>
  );
}
