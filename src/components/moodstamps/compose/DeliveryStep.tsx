'use client';

import { useId, useState } from 'react';
import { COUNTRY_CODES } from '@/lib/moodstamps/catalog';
import type { MoodStampChannel, MoodStampRecord } from '@/lib/moodstamps/types';
import { moodStampDeliverySchema, normalisePhone, type MoodStampDelivery, type MoodStampDraft } from '@/lib/moodstamps/validation';

const CHANNELS: Array<{ channel: MoodStampChannel; title: string; description: string }> = [
  { channel: 'email', title: 'Email', description: 'Send it to their inbox.' },
  { channel: 'whatsapp', title: 'WhatsApp', description: 'Send it to their phone number.' },
  { channel: 'download', title: 'Download image', description: 'Save it as a picture and hand it over yourself.' },
];

/**
 * Where the stamp goes: an email address, a WhatsApp number, or an image to
 * download.
 *
 * Email and WhatsApp delivery are not switched on yet, and the screen says so
 * before anything is pressed — the stamp is saved as awaiting delivery, never
 * reported as delivered.
 */
export function DeliveryStep({
  draft,
  onBack,
  onSent,
  onDraftRejected,
}: {
  draft: MoodStampDraft;
  onBack: () => void;
  onSent: (record: MoodStampRecord) => void;
  onDraftRejected: (fields: Record<string, string>) => void;
}) {
  const [channel, setChannel] = useState<MoodStampChannel>('email');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState<string>(COUNTRY_CODES[0].code);
  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const errorId = useId();

  const delivery = (): unknown =>
    channel === 'email'
      ? { channel, email }
      : channel === 'whatsapp'
        ? { channel, phone: normalisePhone(countryCode, phone) }
        : { channel };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const checked = moodStampDeliverySchema.safeParse(delivery());
    if (!checked.success) {
      setFieldError(checked.error.issues[0]?.message ?? 'Check this and try again.');
      return;
    }
    setFieldError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/moodstamps', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draft, delivery: checked.data satisfies MoodStampDelivery }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        moodStamp?: MoodStampRecord;
        message?: string;
        fields?: Record<string, string>;
        retryAfterSeconds?: number;
      };

      if (response.status === 401) {
        window.location.assign('/login?returnTo=%2Fmoodstamps%2Fsend');
        return;
      }
      if (response.status === 422 && body.fields) {
        const draftFields = Object.entries(body.fields).filter(([key]) => key.startsWith('draft.'));
        if (draftFields.length > 0) {
          onDraftRejected(Object.fromEntries(draftFields.map(([key, value]) => [key.slice('draft.'.length), value])));
          return;
        }
        setFieldError(Object.values(body.fields)[0] ?? 'Check this and try again.');
        return;
      }
      if (response.status === 429) {
        setFormError('You have sent a lot of MoodStamps in a short time. Give it a little while and try again.');
        return;
      }
      if (!response.ok || !body.moodStamp) {
        setFormError(body.message ?? 'It did not go through. Nothing was sent — try again.');
        return;
      }
      onSent(body.moodStamp);
    } catch {
      setFormError(
        navigator.onLine
          ? 'It did not go through. Nothing was sent — try again.'
          : 'You are offline. Nothing was sent — try again once you are back online.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel =
    channel === 'email' ? 'Send by email' : channel === 'whatsapp' ? 'Send on WhatsApp' : 'Download image';

  return (
    <form noValidate onSubmit={submit} className="max-w-[680px]">
      <fieldset className="msc-card">
        <legend className="sr-only">How should it reach them?</legend>
        <div className="grid gap-3">
          {CHANNELS.map((option) => (
            <label key={option.channel} className="msc-choice msc-choice-compact">
              <input
                type="radio"
                name="channel"
                value={option.channel}
                checked={channel === option.channel}
                onChange={() => {
                  setChannel(option.channel);
                  setFieldError(null);
                }}
                className="sr-only"
              />
              <span className="min-w-0">
                <span className="block text-[16px] font-extrabold">{option.title}</span>
                <span className="mt-1 block text-[13.5px] leading-snug text-[rgb(23_20_15/0.7)]">
                  {option.description}
                </span>
              </span>
              <span className="msc-choice-check" aria-hidden="true" />
            </label>
          ))}
        </div>

        <div className="mt-6">
          {channel === 'email' && (
            <div className="max-w-[420px]">
              <label htmlFor="msc-delivery-email" className="msc-question">
                Their email address
              </label>
              <input
                id="msc-delivery-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="aarav@example.com"
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? errorId : undefined}
                className="field-ink mt-2"
              />
            </div>
          )}

          {channel === 'whatsapp' && (
            <div>
              <p id="msc-phone-label" className="msc-question">
                Their WhatsApp number
              </p>
              <div className="mt-2 grid max-w-[460px] grid-cols-[minmax(0,150px)_minmax(0,1fr)] gap-2">
                <label htmlFor="msc-delivery-country" className="sr-only">
                  Country code
                </label>
                <select
                  id="msc-delivery-country"
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value)}
                  className="field-ink"
                >
                  {COUNTRY_CODES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.label}
                    </option>
                  ))}
                </select>
                <label htmlFor="msc-delivery-phone" className="sr-only">
                  Phone number
                </label>
                <input
                  id="msc-delivery-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="98765 43210"
                  aria-invalid={fieldError ? true : undefined}
                  aria-describedby={fieldError ? errorId : undefined}
                  className="field-ink"
                />
              </div>
            </div>
          )}

          {fieldError && (
            <p id={errorId} className="msc-error mt-2">
              {fieldError}
            </p>
          )}

          <DeliveryNote channel={channel} anonymous={draft.anonymous} />
        </div>
      </fieldset>

      {formError && (
        <p role="alert" className="mt-5 text-[14px] font-semibold text-[color:var(--color-egg)]">
          {formError}
        </p>
      )}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onBack} className="btn btn-outline min-h-[52px] w-full sm:w-auto">
          <span aria-hidden="true">←</span> Back to preview
        </button>
        <button type="submit" disabled={submitting} aria-busy={submitting} className="ms-key ms-cta w-full sm:w-auto">
          {submitting ? 'Sending…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function DeliveryNote({ channel, anonymous }: { channel: MoodStampChannel; anonymous: boolean }) {
  if (channel === 'download') {
    return (
      <p className="msc-note mt-5">
        It is saved to your Sent board as well.
        {anonymous && ' The stamp says Anonymous — but if you send the picture yourself, they will know it came from you.'}
      </p>
    );
  }
  if (channel === 'email') {
    return (
      <p className="msc-note mt-5">
        Skewvy emails it to them as soon as you send it. It comes from Skewvy, and your email address is never shared
        {anonymous ? ' — nor your name' : ''}. They can open it, keep it, or ask not to be sent MoodStamps.
      </p>
    );
  }
  return (
    <p className="msc-note mt-5">
      <strong>WhatsApp delivery is not switched on yet.</strong> Your MoodStamp is saved to your Sent board as{' '}
      <em>Awaiting delivery</em> — nothing reaches them until delivery is live. You can download the image in the
      meantime.
    </p>
  );
}
