'use client';

import { useCallback, useState } from 'react';
import { RobotCheck } from '@/components/auth/AuthForms';
import { SITE_REPORT_REASONS, SITE_REPORT_REASON_LABELS, type SiteReportReason } from '@/lib/domain/site-reports';

const fieldClass =
  'block w-full border-2 border-[var(--border-strong)] bg-transparent px-3.5 py-3 text-[15px] leading-[1.45] text-primary placeholder:text-tertiary focus:border-[color:var(--color-paper)] focus:outline-none';

/**
 * The public report form. Works without an account; the robot check and a
 * per-address limit keep it from becoming a spam channel. On success it says
 * only that the report arrived — nothing about other reports or outcomes.
 */
export function ReportForm({
  siteKey,
  turnstileDisabled,
  turnstileRequired,
  defaultUrl,
}: {
  siteKey: string;
  turnstileDisabled: boolean;
  turnstileRequired: boolean;
  defaultUrl: string;
}) {
  const [targetUrl, setTargetUrl] = useState(defaultUrl);
  const [reason, setReason] = useState<SiteReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const onToken = useCallback((value: string | null) => setToken(value), []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFields({});
    if (!token) {
      setError('Complete the robot check before sending.');
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/site-reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetUrl, reason, details, evidenceUrl, contactEmail, turnstileToken: token }),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string; fields?: Record<string, string> };
      if (response.status === 429) {
        setError('You have sent several reports recently. Try again later, or write to team@skewvy.com.');
        return;
      }
      if (!response.ok) {
        setFields(data.fields ?? {});
        setError(data.message ?? 'That did not go through. Check the form and try again.');
        setToken(null);
        return;
      }
      setSent(true);
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <p role="status" className="mt-8 border-l-4 border-[color:var(--color-egg)] pl-4 text-[17px] font-semibold text-primary">
        Report received. Thank you for helping us review Skewvy.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-8 space-y-6">
      {error && (
        <p role="alert" className="text-[14px] font-bold text-[color:var(--color-egg)]">
          {error}
        </p>
      )}

      <Field id="report-url" label="Page or comment URL" error={fields.targetUrl}>
        <input
          id="report-url"
          type="url"
          inputMode="url"
          required
          value={targetUrl}
          onChange={(event) => setTargetUrl(event.target.value)}
          placeholder="https://skewvy.com/…"
          aria-invalid={Boolean(fields.targetUrl)}
          aria-describedby={fields.targetUrl ? 'report-url-error' : undefined}
          className={fieldClass}
        />
      </Field>

      <Field id="report-reason" label="Reason" error={fields.reason}>
        <select
          id="report-reason"
          required
          value={reason}
          onChange={(event) => setReason(event.target.value as SiteReportReason)}
          aria-invalid={Boolean(fields.reason)}
          aria-describedby={fields.reason ? 'report-reason-error' : undefined}
          className={`${fieldClass} bg-[color:var(--color-ground)]`}
        >
          <option value="" disabled>
            Choose a reason
          </option>
          {SITE_REPORT_REASONS.map((value) => (
            <option key={value} value={value}>
              {SITE_REPORT_REASON_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>

      <Field id="report-details" label="Additional details" error={fields.details}>
        <textarea
          id="report-details"
          required
          rows={5}
          maxLength={3000}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="What happened, and what should we look at?"
          aria-invalid={Boolean(fields.details)}
          aria-describedby={fields.details ? 'report-details-error' : undefined}
          className={`${fieldClass} resize-y`}
        />
      </Field>

      <Field id="report-evidence" label="Evidence or reference URL" optional error={fields.evidenceUrl}>
        <input
          id="report-evidence"
          type="url"
          inputMode="url"
          value={evidenceUrl}
          onChange={(event) => setEvidenceUrl(event.target.value)}
          placeholder="https://"
          aria-invalid={Boolean(fields.evidenceUrl)}
          className={fieldClass}
        />
      </Field>

      <Field
        id="report-email"
        label="Contact email"
        optional
        hint="Only if you want a reply. Never shown to anyone else."
        error={fields.contactEmail}
      >
        <input
          id="report-email"
          type="email"
          autoComplete="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
          aria-invalid={Boolean(fields.contactEmail)}
          className={fieldClass}
        />
      </Field>

      <RobotCheck
        siteKey={siteKey}
        disabled={turnstileDisabled}
        required={turnstileRequired}
        action="report"
        onToken={onToken}
      />

      <div>
        <p className="m-0 mb-3.5 max-w-[60ch] text-[14px] leading-[1.55] text-secondary">
          Submitting a report does not guarantee removal. We will review the content, context and available evidence.
        </p>
        <button type="submit" disabled={pending} className="btn bg-egg px-6 py-3.5 text-[15px] font-extrabold text-ink disabled:opacity-60">
          {pending ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  optional = false,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[14px] font-bold text-primary">
        {label}
        {optional && <span className="ml-1.5 font-medium text-tertiary">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="m-0 mt-1.5 text-[13px] font-semibold text-[color:var(--color-egg)]">
          {error}
        </p>
      ) : hint ? (
        <p className="m-0 mt-1.5 text-[13px] text-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}
