'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { InboxLink } from '@/lib/moodstamps/types';

type Change = { paused?: boolean; notify?: boolean; renew?: true };

const SHARE_TEXT = 'Send me a MoodStamp — tell me how I made you feel. No account needed.';

/**
 * The owner's view of their MoodStamp link: the address, ways to hand it out,
 * and the three things they can do to it — pause it, switch off the arrival
 * email, or replace it. Replacing asks first, because the old link stops
 * working for everyone who has it.
 */
export function ReceiveLinkPanel({ initial, emailVerified }: { initial: InboxLink; emailVerified: boolean }) {
  const [link, setLink] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [saving, setSaving] = useState<keyof Change | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRenew, setConfirmingRenew] = useState(false);
  const [renewed, setRenewed] = useState(false);
  const statusId = useId();
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2400);
    } catch {
      setError('Copying is blocked in this browser. Select the link and copy it yourself.');
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: 'Send me a MoodStamp', text: SHARE_TEXT, url: link.url });
    } catch {
      // Closing the share sheet is not an error.
    }
  };

  const change = async (next: Change) => {
    const key = (Object.keys(next)[0] ?? null) as keyof Change | null;
    setSaving(key);
    setError(null);
    try {
      const response = await fetch('/api/moodstamps/inbox-link', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (response.status === 401) {
        window.location.assign('/login?returnTo=%2Fmoodstamps%2Freceive');
        return;
      }
      const body = (await response.json().catch(() => ({}))) as { link?: InboxLink; message?: string };
      if (!response.ok || !body.link) {
        setError(response.status === 429 ? 'That is a lot of changes. Give it a minute.' : 'That did not save. Try again.');
        return;
      }
      setLink(body.link);
      if (next.renew) {
        setConfirmingRenew(false);
        setRenewed(true);
      }
    } catch {
      setError('Could not reach Skewvy. Check your connection and try again.');
    } finally {
      setSaving(null);
    }
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${link.url}`)}`;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <section aria-labelledby="msr-link-title" className="msc-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="msr-link-title" className="msc-label">
            Your link
          </h2>
          <span
            className={`inline-flex items-center gap-2 text-[12.5px] font-bold ${
              link.paused ? 'text-[color:var(--color-egg-deep)]' : 'text-[color:var(--color-positive-deep)]'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 ${link.paused ? 'bg-[color:var(--color-egg)]' : 'bg-[color:var(--color-positive)]'}`}
            />
            {link.paused ? 'Paused — not taking MoodStamps' : 'Open — taking MoodStamps'}
          </span>
        </div>

        <p className="mt-4 break-all border-2 border-ink bg-white/60 px-4 py-3.5 font-mono text-[clamp(16px,1.6vw,20px)] font-bold leading-snug">
          {link.url}
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={copy} className="ms-key ms-cta w-full sm:w-auto" aria-describedby={statusId}>
            {copied ? 'Copied ✓' : 'Copy link'}
          </button>
          {canShare && (
            <button type="button" onClick={share} className="msr-button w-full sm:w-auto">
              Share…
            </button>
          )}
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="msr-button w-full sm:w-auto">
            Share on WhatsApp
          </a>
          <a href={link.url} target="_blank" rel="noopener" className="msr-button w-full sm:w-auto">
            See what they see <span aria-hidden="true">↗</span>
          </a>
        </div>
        <p id={statusId} role="status" className="sr-only">
          {copied ? 'Link copied.' : ''}
        </p>

        {renewed && (
          <p role="status" className="mt-4 text-[13.5px] font-semibold text-[rgb(23_20_15/0.75)]">
            This is your new link. The old one no longer works.
          </p>
        )}

        <div className="mt-6 border-t border-[rgb(23_20_15/0.16)] pt-5 text-[14px] leading-relaxed text-[rgb(23_20_15/0.75)]">
          {link.received === 0 ? (
            <p>Nothing has come in through your link yet. Once you share it, MoodStamps land on your Received board.</p>
          ) : (
            <p>
              <strong className="text-ink">
                {link.received} {link.received === 1 ? 'MoodStamp has' : 'MoodStamps have'}
              </strong>{' '}
              come in through your link.{' '}
              <Link href="/moodstamps?view=received" className="font-bold text-ink underline underline-offset-2">
                Open your Received board
              </Link>
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="msr-settings-title" className="msc-card">
        <h2 id="msr-settings-title" className="msc-label">
          Settings
        </h2>

        <Setting
          title="Take new MoodStamps"
          description={
            link.paused
              ? 'Paused. People who open your link are told you are not taking MoodStamps right now.'
              : 'Anyone with your link can send you one.'
          }
          checked={!link.paused}
          busy={saving === 'paused'}
          onChange={(on) => void change({ paused: !on })}
        />

        <Setting
          title="Email me when one arrives"
          description={
            emailVerified
              ? 'At most one email a day, however many come in.'
              : 'Verify your email address to get these. MoodStamps still reach your board either way.'
          }
          checked={link.notify && emailVerified}
          disabled={!emailVerified}
          busy={saving === 'notify'}
          onChange={(on) => void change({ notify: on })}
        />

        <div className="mt-5 border-t border-[rgb(23_20_15/0.16)] pt-5">
          <p className="text-[15px] font-extrabold">Get a new link</p>
          <p className="mt-1 text-[13.5px] leading-snug text-[rgb(23_20_15/0.7)]">
            If your link has gone somewhere you did not mean it to. The old one stops working at once.
          </p>
          {confirmingRenew ? (
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Confirm a new link">
              <button
                type="button"
                onClick={() => void change({ renew: true })}
                disabled={saving === 'renew'}
                className="msr-button msr-button-danger"
              >
                {saving === 'renew' ? 'Making a new link…' : 'Yes, replace my link'}
              </button>
              <button type="button" onClick={() => setConfirmingRenew(false)} className="msr-button">
                Keep this one
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingRenew(true)} className="msr-button mt-3">
              Get a new link
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-[13.5px] font-bold text-[color:var(--color-egg-deep)]">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

function Setting({
  title,
  description,
  checked,
  disabled = false,
  busy,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  busy: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="mt-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[15px] font-extrabold">
          {title}
        </label>
        <p id={`${id}-note`} className="mt-1 text-[13.5px] leading-snug text-[rgb(23_20_15/0.7)]">
          {description}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-note`}
        aria-busy={busy || undefined}
        disabled={disabled || busy}
        onClick={() => onChange(!checked)}
        className="msr-switch"
      >
        <span aria-hidden="true" className="msr-switch-knob" />
      </button>
    </div>
  );
}
