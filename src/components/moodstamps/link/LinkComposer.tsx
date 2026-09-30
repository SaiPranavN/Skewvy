'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RobotCheck } from '@/components/auth/AuthForms';
import { downloadMoodStamp } from '@/lib/client/moodstamp-image';
import { moderateText, moderationMessage } from '@/lib/moodstamps/moderation';
import { REACTION_VOICES } from '@/lib/moodstamps/catalog';
import { artworkFromRecord, type MoodStampArtworkData, type MoodStampRecord } from '@/lib/moodstamps/types';
import { draftErrors, moodStampDraftSchema, SENDER_NAME_MAX, type MoodStampDraft } from '@/lib/moodstamps/validation';
import { MoodStampArtwork } from '../MoodStampArtwork';
import { ComposeForm, FIELD_IDS, PartHeading } from '../compose/ComposeForm';
import { FieldWarning } from '../compose/LanguageNotice';
import { useMoodStampDraft, type DraftState } from '../compose/useMoodStampDraft';

type Step = 'write' | 'preview' | 'done';
type Errors = Partial<Record<keyof MoodStampDraft | 'senderName', string>>;

const FIELD_ORDER: Array<keyof MoodStampDraft> = [
  'reaction',
  'emotion',
  'quantity',
  'reasonWhat',
  'reasonImpact',
  'reasonRequest',
  'anonymous',
];

const SENDER_FIELD_ID = 'msl-sender-name';

/**
 * Writing a MoodStamp on someone's link: the same form as sending one from
 * an account, addressed already, and open to anyone.
 *
 * Someone signed in signs with their account, verified. Anyone else types a
 * name, which the stamp prints as a name they gave rather than a verified
 * one, or sends it anonymously; either way a robot check stands in for the
 * account they do not have. There is nothing to choose about delivery: it is
 * on the owner's board the moment it is sent.
 */
export function LinkComposer({
  code,
  ownerName,
  account,
  turnstile,
}: {
  code: string;
  ownerName: string;
  /** The signed-in visitor, if there is one. */
  account: { displayName: string } | null;
  turnstile: { siteKey: string; disabled: boolean; required: boolean };
}) {
  const searchParams = useSearchParams();
  const { draft, update, clear, loaded } = useMoodStampDraft(`skewvy:moodstamp-link-draft:${code}`);
  const [guestName, setGuestName] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [sent, setSent] = useState<MoodStampRecord | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [website, setWebsite] = useState('');
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // The name printed as "To:" is the owner's, whatever is in the draft.
  const addressed: DraftState = useMemo(() => ({ ...draft, recipientName: ownerName }), [draft, ownerName]);
  const errors = useMemo(() => draftErrors({ ...addressed, reaction: addressed.reaction ?? undefined }), [addressed]);

  const guest = account === null;
  const nameFlag = guest ? moderationMessage(moderateText(guestName)) : null;
  const nameError =
    nameFlag ??
    (guest && !draft.anonymous && guestName.trim().length === 0 ? 'Add your name, or send it anonymously.' : null);
  const ready = moodStampDraftSchema.safeParse({ ...addressed, reaction: addressed.reaction ?? undefined }).success && !nameError;

  const base = `/to/${code}`;
  const requested = searchParams.get('step');
  const asked: Step = requested === 'preview' || requested === 'done' ? requested : 'write';
  let step: Step = asked;
  if (step === 'preview' && !ready) step = 'write';
  if (step === 'done' && !sent) step = 'write';

  const go = useCallback(
    (next: Step, replace = false) => {
      const url = next === 'write' ? base : `${base}?step=${next}`;
      if (replace) window.history.replaceState(null, '', url);
      else window.history.pushState(null, '', url);
    },
    [base],
  );

  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const senderLabel = account ? account.displayName : guestName.trim() || 'Your name';
  const artwork = (state: MoodStampArtworkData['state']): MoodStampArtworkData => ({
    reaction: draft.reaction ?? 'medal',
    emotion: draft.emotion.trim() || 'Your feeling',
    quantity: draft.quantity,
    senderName: senderLabel,
    anonymous: draft.anonymous,
    senderVerified: !guest,
    recipientName: ownerName,
    reasons: [draft.reasonWhat.trim() || '…', draft.reasonImpact.trim() || '…', draft.reasonRequest.trim() || '…'],
    receiptCode: null,
    date: new Date().toISOString(),
    state,
  });

  const preview = () => {
    if (ready) {
      setServerErrors({});
      setFormError(null);
      go('preview');
      return;
    }
    setShowErrors(true);
    const first = FIELD_ORDER.find((field) => errors[field]);
    const targetId = first ? FIELD_IDS[first] : nameError ? SENDER_FIELD_ID : null;
    if (targetId) {
      const target = document.getElementById(targetId);
      const focusable =
        target?.matches('input, textarea, select') ? target : target?.querySelector<HTMLElement>('input, textarea');
      target?.scrollIntoView({ block: 'center' });
      focusable?.focus({ preventScroll: true });
    }
  };

  const send = async () => {
    if (guest && !token) {
      setFormError('Complete the robot check before sending.');
      return;
    }
    setSending(true);
    setFormError(null);
    try {
      const linkDraft = {
        reaction: draft.reaction,
        emotion: draft.emotion,
        quantity: draft.quantity,
        reasonWhat: draft.reasonWhat,
        reasonImpact: draft.reasonImpact,
        reasonRequest: draft.reasonRequest,
        anonymous: draft.anonymous,
      };
      const response = await fetch(`/api/moodstamps/to/${code}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          draft: linkDraft,
          senderName: guest && !draft.anonymous ? guestName.trim() : '',
          turnstileToken: token ?? '',
          website,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        moodStamp?: MoodStampRecord;
        message?: string;
        fields?: Record<string, string>;
      };

      if (response.status === 422 && body.fields) {
        const next: Errors = {};
        for (const [key, value] of Object.entries(body.fields)) {
          next[(key.startsWith('draft.') ? key.slice(6) : key) as keyof Errors] = value;
        }
        setServerErrors(next);
        setShowErrors(true);
        go('write');
        return;
      }
      if (!response.ok || !body.moodStamp) {
        setFormError(body.message ?? 'It did not go through. Nothing was sent — try again.');
        setToken(null);
        return;
      }
      setSent(body.moodStamp);
      clear();
      setGuestName('');
      setShowErrors(false);
      go('done', true);
    } catch {
      setFormError(
        navigator.onLine
          ? 'It did not go through. Nothing was sent — try again.'
          : 'You are offline. Nothing was sent — try again once you are back online.',
      );
    } finally {
      setSending(false);
    }
  };

  const shownErrors: Errors = { ...(showErrors ? errors : {}), ...serverErrors };
  const voice = draft.reaction ? REACTION_VOICES[draft.reaction] : null;
  const onToken = useCallback((value: string | null) => setToken(value), []);

  const heading =
    step === 'done'
      ? { title: `Sent to ${ownerName}.`, intro: `It is on ${ownerName}’s MoodStamps board now.` }
      : step === 'preview'
        ? { title: 'Read it as they will.', intro: 'This is exactly how your MoodStamp will look.' }
        : {
            title: `Send ${ownerName} a MoodStamp.`,
            intro: `Tell ${ownerName} how they made you feel — name it, count it, say why. No account needed, and it takes about two minutes.`,
          };

  return (
    <div className="rail page-enter pb-[clamp(56px,7vw,110px)] pt-[clamp(24px,3vw,44px)]">
      <header className="max-w-[760px]">
        <p className="eyebrow text-[color:var(--color-violet)]">MoodStamp for {ownerName}</p>
        <h1 ref={headingRef} tabIndex={-1} className="display mt-3 text-[clamp(32px,4vw,54px)] focus:outline-none">
          {heading.title}
        </h1>
        <p className="mt-3 max-w-[56ch] text-[clamp(15px,1.15vw,17px)] leading-[1.5] text-secondary">{heading.intro}</p>
      </header>

      <div className="mt-[clamp(24px,3vw,40px)] min-h-[60vh]">
        {loaded && step === 'write' && (
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.78fr)]">
            <div>
              <ComposeForm
                draft={addressed}
                update={(key, value) => {
                  update(key, value);
                  if (serverErrors[key as keyof Errors]) setServerErrors((current) => ({ ...current, [key]: undefined }));
                }}
                errors={shownErrors}
                senderName={senderLabel}
                onPreview={preview}
                who={
                  <FromSection
                    ownerName={ownerName}
                    account={account}
                    signInHref={`/login?returnTo=${encodeURIComponent(base)}`}
                    anonymous={draft.anonymous}
                    onAnonymous={(value) => update('anonymous', value)}
                    guestName={guestName}
                    onGuestName={(value) => {
                      setGuestName(value);
                      if (serverErrors.senderName) setServerErrors((current) => ({ ...current, senderName: undefined }));
                    }}
                    nameMessage={nameFlag ?? serverErrors.senderName ?? (showErrors ? nameError : null)}
                  />
                }
              />
              {/* Left empty by people; hidden from them and from assistive technology. */}
              <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
                <label>
                  Website
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                  />
                </label>
              </div>
            </div>
            <aside aria-label="Live preview" className="sticky top-24 hidden lg:block">
              <p className="eyebrow mb-4">Live preview</p>
              {voice ? (
                <MoodStampArtwork data={artwork('preview')} />
              ) : (
                <div className="grid aspect-[4/5] place-items-center border-2 border-dashed border-[var(--border-strong)] px-8 text-center text-[14px] text-tertiary">
                  Choose Medals or Rotten Eggs, and your MoodStamp starts taking shape here.
                </div>
              )}
            </aside>
          </div>
        )}

        {loaded && step === 'preview' && (
          <div className="max-w-[680px]">
            <div className="ms-example-in">
              <MoodStampArtwork data={artwork('preview')} />
            </div>

            <div className="mt-8 space-y-3 text-[14px] leading-relaxed text-secondary">
              <p>
                It goes straight onto {ownerName}’s MoodStamps board.{' '}
                {draft.anonymous
                  ? `Signed “Anonymous”: Skewvy does not tell ${ownerName} who sent it.`
                  : guest
                    ? `Signed with the name you gave. The stamp says it was not verified by an account.`
                    : `Signed with your Skewvy name. It also appears on your Sent board.`}
              </p>
            </div>

            {guest && (
              <div className="mt-6">
                <RobotCheck
                  siteKey={turnstile.siteKey}
                  disabled={turnstile.disabled}
                  required={turnstile.required}
                  action="moodstamp"
                  onToken={onToken}
                />
              </div>
            )}

            {formError && (
              <p role="alert" className="mt-5 text-[14px] font-semibold text-[color:var(--color-egg)]">
                {formError}
              </p>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => go('write')} className="btn btn-outline min-h-[52px] w-full sm:w-auto">
                <span aria-hidden="true">←</span> Edit
              </button>
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending}
                aria-busy={sending}
                className="ms-key ms-cta w-full sm:w-auto"
              >
                {sending ? 'Sending…' : `Send to ${ownerName}`}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && sent && (
          <SentToOwner
            record={sent}
            ownerName={ownerName}
            signedIn={!guest}
            onSendAnother={() => {
              setSent(null);
              go('write', true);
            }}
          />
        )}
      </div>
    </div>
  );
}

/** Part 04 on a link: who it is for is settled; who it is from is the question. */
function FromSection({
  ownerName,
  account,
  signInHref,
  anonymous,
  onAnonymous,
  guestName,
  onGuestName,
  nameMessage,
}: {
  ownerName: string;
  account: { displayName: string } | null;
  signInHref: string;
  anonymous: boolean;
  onAnonymous: (value: boolean) => void;
  guestName: string;
  onGuestName: (value: string) => void;
  nameMessage: string | null;
}) {
  return (
    <section aria-labelledby="msc-part-who" className="msc-card">
      <PartHeading id="msc-part-who" number="04" title="From you" />
      <p className="mt-2 text-[14px] text-[rgb(23_20_15/0.7)]">
        To: <strong className="text-ink">{ownerName}</strong>
      </p>

      <fieldset className="mt-6">
        <legend className="msc-legend">How should it be signed?</legend>
        <div id={FIELD_IDS.anonymous} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="msc-choice msc-choice-compact">
            <input
              type="radio"
              name="signature"
              checked={!anonymous}
              onChange={() => onAnonymous(false)}
              className="sr-only"
            />
            <span className="min-w-0">
              <span className="block text-[15.5px] font-extrabold">With my name</span>
              <span className="mt-1 block truncate text-[13px] text-[rgb(23_20_15/0.7)]">
                {account ? `From: ${account.displayName}` : 'You type it; it is not verified.'}
              </span>
            </span>
            <span className="msc-choice-check" aria-hidden="true" />
          </label>
          <label className="msc-choice msc-choice-compact">
            <input
              type="radio"
              name="signature"
              checked={anonymous}
              onChange={() => onAnonymous(true)}
              className="sr-only"
            />
            <span className="min-w-0">
              <span className="block text-[15.5px] font-extrabold">Anonymously</span>
              <span className="mt-1 block text-[13px] leading-snug text-[rgb(23_20_15/0.7)]">
                {account
                  ? 'They see “Anonymous”, and that Skewvy verified the sender.'
                  : `They see “Anonymous”. Skewvy does not tell ${ownerName} who you are.`}
              </span>
            </span>
            <span className="msc-choice-check" aria-hidden="true" />
          </label>
        </div>
      </fieldset>

      {!account && !anonymous && (
        <div className="mt-5 max-w-[380px]">
          <label htmlFor={SENDER_FIELD_ID} className="msc-question">
            Your name
          </label>
          <input
            id={SENDER_FIELD_ID}
            type="text"
            value={guestName}
            onChange={(event) => onGuestName(event.target.value)}
            maxLength={SENDER_NAME_MAX}
            placeholder="Priya"
            autoComplete="given-name"
            aria-invalid={nameMessage ? true : undefined}
            aria-describedby={`${SENDER_FIELD_ID}-note`}
            className="field-ink mt-2"
          />
          <FieldWarning id={`${SENDER_FIELD_ID}-note`} message={nameMessage} />
        </div>
      )}

      {!account && (
        <p className="mt-5 text-[12.5px] leading-snug text-[rgb(23_20_15/0.6)]">
          No account needed.{' '}
          <Link href={signInHref} className="font-bold underline underline-offset-2">
            Sign in
          </Link>{' '}
          if you have one, and your name is verified.
        </p>
      )}
    </section>
  );
}

/** After sending: where it went, a copy for them to keep, and a link of their own. */
function SentToOwner({
  record,
  ownerName,
  signedIn,
  onSendAnother,
}: {
  record: MoodStampRecord;
  ownerName: string;
  signedIn: boolean;
  onSendAnother: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);

  const download = async () => {
    setDownloading(true);
    setDownloadFailed(false);
    const ok = await downloadMoodStamp({ ...artworkFromRecord(record), state: 'sent' });
    setDownloadFailed(!ok);
    setDownloading(false);
  };

  return (
    <div className="grid max-w-[1080px] items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
      <div>
        <p className="text-[16px] leading-relaxed text-secondary">
          {ownerName} will find it on their MoodStamps board.
          {signedIn ? ' It is on your Sent board too.' : ' Keep a copy if you like — it will not be shown to you again.'}
        </p>
        <p className="mt-3 text-[14px] font-semibold text-tertiary">Receipt {record.receiptCode}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={download} disabled={downloading} className="btn btn-outline min-h-[52px] w-full sm:w-auto">
            {downloading ? 'Preparing…' : 'Download a copy'}
          </button>
          <button type="button" onClick={onSendAnother} className="btn btn-outline min-h-[52px] w-full sm:w-auto">
            Send another
          </button>
        </div>
        {downloadFailed && (
          <p role="alert" className="mt-3 text-[13.5px] font-semibold text-[color:var(--color-egg)]">
            The image could not be made in this browser. Try again, or take a screenshot.
          </p>
        )}

        <div className="msc-card mt-10">
          <p className="text-[18px] font-extrabold leading-snug">Want MoodStamps of your own?</p>
          <p className="mt-2 text-[14px] leading-relaxed text-[rgb(23_20_15/0.72)]">
            Get a link like {ownerName}’s and find out how you make people feel.
          </p>
          <Link
            href={signedIn ? '/moodstamps/receive' : `/register?returnTo=${encodeURIComponent('/moodstamps/receive')}`}
            className="ms-key ms-cta mt-5 w-full sm:w-auto"
          >
            {signedIn ? 'Get your link' : 'Create a free account'}
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[460px]">
        <MoodStampArtwork data={{ ...artworkFromRecord(record), state: 'sent' }} />
      </div>
    </div>
  );
}
