'use client';

import { useId, useState } from 'react';
import { PIN_MIN_LENGTH } from '@/lib/validation/schemas';

/**
 * Form controls for the authentication surfaces.
 *
 * Every auth panel is cream paper, so these are ink-on-paper controls: square,
 * hairline-edged, no fill of their own. Nothing here rounds, and the only
 * colour is the orange caret and the orange submit.
 */

const inputClass = 'field-ink text-[0.9375rem] transition-colors duration-150';

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
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-bold uppercase leading-none tracking-[0.12em] text-[rgb(23_20_15_/_0.6)]"
      >
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs leading-relaxed text-[rgb(23_20_15_/_0.6)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="text-xs font-bold text-[color:var(--color-egg-deep)]">
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
        className={`${inputClass} ${error ? 'border-[color:var(--color-egg-deep)]' : ''}`}
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
          className={`${inputClass} pr-[72px] tracking-[0.12em] ${error ? 'border-[color:var(--color-egg-deep)]' : ''}`}
          {...props}
        />
        <button
          type="button"
          id={toggleId}
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-2 my-auto h-8 px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[rgb(23_20_15_/_0.6)] transition-colors duration-150 hover:text-ink"
        >
          {visible ? 'Hide' : 'Show'}
          <span className="sr-only"> PIN</span>
        </button>
      </div>
    </Field>
  );
}

/** A banner on paper. The square marker carries the state, never colour alone. */
function Banner({
  role,
  marker,
  tone,
  message,
}: {
  role: 'alert' | 'status';
  marker: string;
  tone: string;
  message: string;
}) {
  return (
    <div role={role} className="flex items-start gap-3 border border-[var(--rule-default)] px-3.5 py-3 text-sm">
      <span aria-hidden="true" className={`mt-[3px] h-2.5 w-2.5 shrink-0 ${tone}`} />
      <span>
        <span className="sr-only">{marker}: </span>
        {message}
      </span>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <Banner role="alert" marker="Error" tone="bg-egg" message={message} />;
}

export function FormNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return <Banner role="status" marker="Notice" tone="bg-medal" message={message} />;
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
      className="btn min-h-[52px] w-full justify-center border-2 border-ink bg-egg px-4 py-3.5 text-[15px] font-extrabold text-ink disabled:cursor-not-allowed disabled:opacity-50"
      {...props}
    >
      {pending && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-[2px] border-[rgb(23_20_15_/_0.3)] border-t-ink"
        />
      )}
      {children}
    </button>
  );
}
