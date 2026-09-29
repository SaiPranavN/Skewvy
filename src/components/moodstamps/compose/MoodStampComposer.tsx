'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { downloadMoodStamp } from '@/lib/client/moodstamp-image';
import { REACTION_VOICES } from '@/lib/moodstamps/catalog';
import { artworkFromRecord, type MoodStampArtworkData, type MoodStampRecord } from '@/lib/moodstamps/types';
import { draftErrors, moodStampDraftSchema, type MoodStampDraft } from '@/lib/moodstamps/validation';
import { MoodStampArtwork } from '../MoodStampArtwork';
import { ComposeForm, FIELD_IDS } from './ComposeForm';
import { DeliveryStep } from './DeliveryStep';
import { PreviewStep } from './PreviewStep';
import { SentStep } from './SentStep';
import { useMoodStampDraft, type DraftState } from './useMoodStampDraft';

type Step = 'write' | 'preview' | 'send' | 'done';

const HEADINGS: Record<Step, { title: string; intro: string }> = {
  write: {
    title: 'Put the feeling into words.',
    intro: 'Name it, count it, and say why. It takes about two minutes, and nothing leaves until you say so.',
  },
  preview: { title: 'Read it as they will.', intro: 'This is exactly how your MoodStamp will look.' },
  send: { title: 'Where should it go?', intro: 'Choose how it reaches them.' },
  done: { title: 'It’s on your board.', intro: '' },
};

const FIELD_ORDER: Array<keyof MoodStampDraft> = [
  'reaction',
  'emotion',
  'quantity',
  'reasonWhat',
  'reasonImpact',
  'reasonRequest',
  'recipientName',
  'anonymous',
];

function asInput(draft: DraftState): unknown {
  return { ...draft, reaction: draft.reaction ?? undefined };
}

function artworkFor(draft: DraftState, senderName: string, state: MoodStampArtworkData['state']): MoodStampArtworkData {
  return {
    reaction: draft.reaction ?? 'medal',
    emotion: draft.emotion.trim() || 'Your feeling',
    quantity: draft.quantity,
    senderName,
    anonymous: draft.anonymous,
    recipientName: draft.recipientName.trim() || 'Their name',
    reasons: [draft.reasonWhat.trim() || '…', draft.reasonImpact.trim() || '…', draft.reasonRequest.trim() || '…'],
    receiptCode: null,
    date: new Date().toISOString(),
    state,
  };
}

/**
 * Sending a MoodStamp: write it, preview it, choose where it goes.
 *
 * Each step is a history entry (`?step=preview`), so the browser's Back goes
 * from the preview to the form with everything still filled in, and a reload
 * lands on the same step. A step that needs a finished draft falls back to the
 * form when there is not one.
 */
export function MoodStampComposer({ senderName }: { senderName: string }) {
  const searchParams = useSearchParams();
  const { draft, update, clear, loaded } = useMoodStampDraft();
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<Partial<Record<keyof MoodStampDraft, string>>>({});
  const [sent, setSent] = useState<MoodStampRecord | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const errors = useMemo(() => draftErrors(asInput(draft)), [draft]);
  const parsed = useMemo(() => moodStampDraftSchema.safeParse(asInput(draft)), [draft]);
  const ready = parsed.success;

  const requested = searchParams.get('step');
  const asked: Step = requested === 'preview' || requested === 'send' || requested === 'done' ? requested : 'write';
  let step: Step = asked;
  if ((step === 'preview' || step === 'send') && !ready) step = 'write';
  if (step === 'done' && !sent) step = 'write';
  // Before the saved draft is read, the heading follows the address rather than guessing.
  const headingStep: Step = loaded ? step : asked === 'done' ? 'write' : asked;

  const go = useCallback((next: Step, replace = false) => {
    const url = next === 'write' ? '/moodstamps/send' : `/moodstamps/send?step=${next}`;
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
  }, []);

  // A new step is a new screen: start at its top, and tell assistive technology where they are.
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const preview = () => {
    if (ready) {
      setServerErrors({});
      go('preview');
      return;
    }
    setShowErrors(true);
    const first = FIELD_ORDER.find((field) => errors[field]);
    if (first) {
      const target = document.getElementById(FIELD_IDS[first]);
      const focusable =
        target?.matches('input, textarea, select') ? target : target?.querySelector<HTMLElement>('input, textarea');
      target?.scrollIntoView({ block: 'center' });
      focusable?.focus({ preventScroll: true });
    }
  };

  const onSent = async (record: MoodStampRecord) => {
    setSent(record);
    clear();
    setShowErrors(false);
    go('done', true);
    if (record.channel === 'download') await downloadMoodStamp(artworkFromRecord(record));
  };

  const shownErrors = { ...(showErrors ? errors : {}), ...serverErrors };
  const heading = HEADINGS[headingStep];
  const voice = draft.reaction ? REACTION_VOICES[draft.reaction] : null;

  return (
    <div className="rail page-enter pb-[clamp(56px,7vw,110px)] pt-[clamp(24px,3vw,44px)]">
      <header className="max-w-[720px]">
        <p className="eyebrow text-[color:var(--color-violet)]">Send a MoodStamp</p>
        <h1 ref={headingRef} tabIndex={-1} className="display mt-3 text-[clamp(32px,4vw,54px)] focus:outline-none">
          {heading.title}
        </h1>
        {heading.intro && (
          <p className="mt-3 max-w-[52ch] text-[clamp(15px,1.15vw,17px)] leading-[1.5] text-secondary">
            {heading.intro}
          </p>
        )}
        <StepTrail step={headingStep} />
      </header>

      <div className="mt-[clamp(24px,3vw,40px)] min-h-[60vh]">
        {loaded && step === 'write' && (
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.78fr)]">
            <ComposeForm
              draft={draft}
              update={(key, value) => {
                update(key, value);
                if (serverErrors[key as keyof MoodStampDraft]) {
                  setServerErrors((current) => ({ ...current, [key]: undefined }));
                }
              }}
              errors={shownErrors}
              senderName={senderName}
              onPreview={preview}
            />
            <aside aria-label="Live preview" className="sticky top-24 hidden lg:block">
              <p className="eyebrow mb-4">Live preview</p>
              {voice ? (
                <MoodStampArtwork data={artworkFor(draft, senderName, 'preview')} />
              ) : (
                <div className="grid aspect-[4/5] place-items-center border-2 border-dashed border-[var(--border-strong)] px-8 text-center text-[14px] text-tertiary">
                  Choose Medals or Rotten Eggs, and your MoodStamp starts taking shape here.
                </div>
              )}
            </aside>
          </div>
        )}

        {loaded && step === 'preview' && (
          <PreviewStep
            artwork={artworkFor(draft, senderName, 'preview')}
            onEdit={() => go('write')}
            onSend={() => go('send')}
          />
        )}

        {loaded && step === 'send' && parsed.success && (
          <DeliveryStep
            draft={parsed.data}
            onBack={() => go('preview')}
            onSent={onSent}
            onDraftRejected={(fields) => {
              setServerErrors(fields as Partial<Record<keyof MoodStampDraft, string>>);
              setShowErrors(true);
              go('write');
            }}
          />
        )}

        {step === 'done' && sent && (
          <SentStep
            record={sent}
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

const TRAIL: Array<{ step: Step; label: string }> = [
  { step: 'write', label: 'Write' },
  { step: 'preview', label: 'Preview' },
  { step: 'send', label: 'Send' },
];

/** Where they are in the three steps. Text, not just colour, marks the current one. */
function StepTrail({ step }: { step: Step }) {
  const index = step === 'done' ? TRAIL.length : TRAIL.findIndex((item) => item.step === step);
  return (
    <ol className="msc-trail mt-6" aria-label="Steps">
      {TRAIL.map((item, position) => (
        <li
          key={item.step}
          data-state={position < index ? 'done' : position === index ? 'current' : 'next'}
          aria-current={position === index ? 'step' : undefined}
        >
          <span className="msc-trail-number">{position < index ? '✓' : position + 1}</span>
          {item.label}
        </li>
      ))}
    </ol>
  );
}
