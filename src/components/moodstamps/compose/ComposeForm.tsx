'use client';

import { useMemo } from 'react';
import {
  EMOTION_MAX,
  QUANTITY_MAX,
  QUANTITY_MIN,
  QUANTITY_PRESETS,
  REACTION_VOICES,
  REASON_LIMITS,
  RECIPIENT_NAME_MAX,
  intensityLabel,
} from '@/lib/moodstamps/catalog';
import { moderateText, moderationMessage } from '@/lib/moodstamps/moderation';
import type { MoodStampDraft } from '@/lib/moodstamps/validation';
import { EggMark, MedalMark } from '../MoodStampMarks';
import { FieldWarning, LanguageNotice } from './LanguageNotice';
import type { DraftState } from './useMoodStampDraft';

type Errors = Partial<Record<keyof MoodStampDraft, string>>;

export const FIELD_IDS: Record<keyof MoodStampDraft, string> = {
  reaction: 'msc-reaction',
  emotion: 'msc-emotion',
  quantity: 'msc-quantity',
  reasonWhat: 'msc-reason-what',
  reasonImpact: 'msc-reason-impact',
  reasonRequest: 'msc-reason-request',
  recipientName: 'msc-recipient',
  anonymous: 'msc-anonymous',
};

/**
 * Writing a MoodStamp: the feeling, how much of it, why, and who it is for.
 *
 * One page in four numbered parts rather than a wizard — every part is short,
 * and seeing the whole thing at once is what lets someone judge whether it
 * says what they mean. Language checks run as they type; the rest of the
 * validation waits until they ask to preview, so an empty form is not a wall
 * of red.
 */
export function ComposeForm({
  draft,
  update,
  errors,
  senderName,
  onPreview,
}: {
  draft: DraftState;
  update: <K extends keyof DraftState>(key: K, value: DraftState[K]) => void;
  errors: Errors;
  senderName: string;
  onPreview: () => void;
}) {
  const voice = draft.reaction ? REACTION_VOICES[draft.reaction] : null;

  const flags = useMemo(
    () => ({
      emotion: moderationMessage(moderateText(draft.emotion)),
      reasonWhat: moderationMessage(moderateText(draft.reasonWhat)),
      reasonImpact: moderationMessage(moderateText(draft.reasonImpact)),
      reasonRequest: moderationMessage(moderateText(draft.reasonRequest)),
      recipientName: moderationMessage(moderateText(draft.recipientName)),
    }),
    [draft.emotion, draft.reasonWhat, draft.reasonImpact, draft.reasonRequest, draft.recipientName],
  );
  const flagged = Object.values(flags).filter(Boolean).length;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onPreview();
      }}
      className="space-y-5"
    >
      <LanguageNotice />

      {/* 01 — The feeling */}
      <section aria-labelledby="msc-part-feeling" className="msc-card">
        <PartHeading id="msc-part-feeling" number="01" title="The feeling" />

        <fieldset className="mt-5">
          <legend className="msc-legend">What are you sending?</legend>
          <div id={FIELD_IDS.reaction} className="mt-3 grid gap-3 sm:grid-cols-2">
            {(['medal', 'rotten_egg'] as const).map((reaction) => {
              const option = REACTION_VOICES[reaction];
              return (
                <label key={reaction} className="msc-choice" data-reaction={reaction}>
                  <input
                    type="radio"
                    name="reaction"
                    value={reaction}
                    checked={draft.reaction === reaction}
                    onChange={() => update('reaction', reaction)}
                    className="sr-only"
                  />
                  <span className="msc-choice-mark" aria-hidden="true">
                    {reaction === 'medal' ? <MedalMark /> : <EggMark />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[17px] font-extrabold leading-tight">{option.plural}</span>
                    <span className="mt-1 block text-[13.5px] leading-snug text-[rgb(23_20_15/0.72)]">
                      {option.meaning}
                    </span>
                  </span>
                  <span className="msc-choice-check" aria-hidden="true" />
                </label>
              );
            })}
          </div>
          {errors.reaction && <p className="msc-error mt-3">{errors.reaction}</p>}
        </fieldset>

        <fieldset className="mt-7" disabled={!voice} aria-describedby={voice ? undefined : 'msc-emotion-wait'}>
          <legend className="msc-legend">{voice ? `${voice.lead}…` : 'How did it make you feel?'}</legend>
          {!voice && (
            <p id="msc-emotion-wait" className="mt-2 text-[13.5px] text-[rgb(23_20_15/0.6)]">
              Choose Medals or Rotten Eggs first, and the feelings that go with it appear here.
            </p>
          )}
          {voice && (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {voice.emotions.map((emotion) => (
                  <label key={emotion} className="msc-chip">
                    <input
                      type="radio"
                      name="emotion-suggestion"
                      value={emotion}
                      checked={draft.emotion === emotion}
                      onChange={() => update('emotion', emotion)}
                      className="sr-only"
                    />
                    {emotion}
                  </label>
                ))}
              </div>
              <div className="mt-4 max-w-[340px]">
                <label htmlFor={FIELD_IDS.emotion} className="msc-label">
                  Or in your own words
                </label>
                <input
                  id={FIELD_IDS.emotion}
                  type="text"
                  value={voice.emotions.includes(draft.emotion) ? '' : draft.emotion}
                  onChange={(event) => update('emotion', event.target.value)}
                  maxLength={EMOTION_MAX}
                  placeholder={draft.reaction === 'medal' ? 'e.g. Seen' : 'e.g. Sidelined'}
                  autoComplete="off"
                  aria-invalid={flags.emotion || errors.emotion ? true : undefined}
                  aria-describedby={`${FIELD_IDS.emotion}-note`}
                  className="field-ink mt-1.5"
                />
              </div>
              <FieldWarning id={`${FIELD_IDS.emotion}-note`} message={flags.emotion ?? errors.emotion ?? null} />
            </>
          )}
        </fieldset>
      </section>

      {/* 02 — How much */}
      <section aria-labelledby="msc-part-count" className="msc-card">
        <PartHeading id="msc-part-count" number="02" title="How much" />
        <p className="mt-2 text-[14px] text-[rgb(23_20_15/0.7)]">The number is how strongly you feel it.</p>

        <div className="mt-5 flex flex-wrap items-end gap-x-5 gap-y-2">
          <p className="numeric-lg text-[clamp(56px,9vw,84px)]" aria-hidden="true">
            {draft.quantity}
          </p>
          <p className="pb-2">
            <span className="block text-[18px] font-extrabold">
              {voice ? (draft.quantity === 1 ? voice.singular : voice.plural) : 'Medals or Rotten Eggs'}
            </span>
            <span className="block text-[13.5px] font-semibold text-[rgb(23_20_15/0.65)]">
              {intensityLabel(draft.quantity)}
            </span>
          </p>
        </div>

        <label htmlFor={FIELD_IDS.quantity} className="sr-only">
          How many {voice?.plural ?? 'Medals or Rotten Eggs'}
        </label>
        <input
          id={FIELD_IDS.quantity}
          type="range"
          min={QUANTITY_MIN}
          max={QUANTITY_MAX}
          value={draft.quantity}
          onChange={(event) => update('quantity', Number(event.target.value))}
          aria-valuetext={`${draft.quantity} — ${intensityLabel(draft.quantity)}`}
          className="msc-range mt-4"
        />
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Quick amounts">
          {QUANTITY_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={draft.quantity === preset}
              onClick={() => update('quantity', preset)}
              className="msc-chip msc-chip-button"
            >
              {preset}
            </button>
          ))}
        </div>
        {errors.quantity && <p className="msc-error mt-3">{errors.quantity}</p>}
      </section>

      {/* 03 — Why */}
      <section aria-labelledby="msc-part-why" className="msc-card">
        <PartHeading id="msc-part-why" number="03" title="Why" />
        <p className="mt-2 text-[14px] text-[rgb(23_20_15/0.7)]">
          Three short answers. Each is printed on the stamp, the last one large.
        </p>

        {(['reasonWhat', 'reasonImpact', 'reasonRequest'] as const).map((field, index) => {
          const prompt = (voice ?? REACTION_VOICES.medal).reasons[index];
          const limit = REASON_LIMITS[index];
          const value = draft[field];
          const message = flags[field] ?? errors[field] ?? null;
          return (
            <div key={field} className="mt-6">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={FIELD_IDS[field]} className="msc-question">
                  <span className="msc-question-number">{String(index + 1).padStart(2, '0')}</span>
                  {voice ? prompt.question : ['What happened?', 'How did it affect you?', 'What do you want them to know?'][index]}
                </label>
                <span className="msc-counter" aria-hidden="true" data-near={value.length > limit - 15 || undefined}>
                  {value.length}/{limit}
                </span>
              </div>
              <textarea
                id={FIELD_IDS[field]}
                value={value}
                onChange={(event) => update(field, event.target.value)}
                maxLength={limit}
                rows={index === 2 ? 2 : 3}
                placeholder={voice ? prompt.placeholder : ''}
                aria-invalid={message ? true : undefined}
                aria-describedby={`${FIELD_IDS[field]}-note`}
                className="field-ink mt-2 resize-y"
              />
              <FieldWarning id={`${FIELD_IDS[field]}-note`} message={message} />
            </div>
          );
        })}
      </section>

      {/* 04 — Who */}
      <section aria-labelledby="msc-part-who" className="msc-card">
        <PartHeading id="msc-part-who" number="04" title="Who it’s for" />

        <div className="mt-5 max-w-[380px]">
          <label htmlFor={FIELD_IDS.recipientName} className="msc-question">
            Their name
          </label>
          <input
            id={FIELD_IDS.recipientName}
            type="text"
            value={draft.recipientName}
            onChange={(event) => update('recipientName', event.target.value)}
            maxLength={RECIPIENT_NAME_MAX}
            placeholder="Aarav"
            autoComplete="off"
            aria-invalid={flags.recipientName || errors.recipientName ? true : undefined}
            aria-describedby={`${FIELD_IDS.recipientName}-note`}
            className="field-ink mt-2"
          />
          <FieldWarning
            id={`${FIELD_IDS.recipientName}-note`}
            message={flags.recipientName ?? errors.recipientName ?? null}
          />
          <p className="mt-2 text-[12.5px] text-[rgb(23_20_15/0.6)]">
            Printed on the stamp. Where it goes is chosen after the preview.
          </p>
        </div>

        <fieldset className="mt-7">
          <legend className="msc-legend">How should it be signed?</legend>
          <div id={FIELD_IDS.anonymous} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="msc-choice msc-choice-compact">
              <input
                type="radio"
                name="signature"
                checked={!draft.anonymous}
                onChange={() => update('anonymous', false)}
                className="sr-only"
              />
              <span className="min-w-0">
                <span className="block text-[15.5px] font-extrabold">With my name</span>
                <span className="mt-1 block truncate text-[13px] text-[rgb(23_20_15/0.7)]">From: {senderName}</span>
              </span>
              <span className="msc-choice-check" aria-hidden="true" />
            </label>
            <label className="msc-choice msc-choice-compact">
              <input
                type="radio"
                name="signature"
                checked={draft.anonymous}
                onChange={() => update('anonymous', true)}
                className="sr-only"
              />
              <span className="min-w-0">
                <span className="block text-[15.5px] font-extrabold">Anonymously</span>
                <span className="mt-1 block text-[13px] leading-snug text-[rgb(23_20_15/0.7)]">
                  They see “Anonymous”, and that Skewvy verified the sender.
                </span>
              </span>
              <span className="msc-choice-check" aria-hidden="true" />
            </label>
          </div>
        </fieldset>
      </section>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
        <button type="submit" className="ms-key ms-cta w-full sm:w-auto">
          Preview your MoodStamp
        </button>
        {flagged > 0 && (
          <p className="text-[13.5px] font-semibold text-[color:var(--color-egg)]">
            {flagged === 1 ? 'One part needs' : `${flagged} parts need`} different wording before it can be sent.
          </p>
        )}
      </div>
    </form>
  );
}

function PartHeading({ id, number, title }: { id: string; number: string; title: string }) {
  return (
    <h2 id={id} className="flex items-baseline gap-3">
      <span className="text-[12px] font-extrabold tracking-[0.14em] text-[rgb(23_20_15/0.5)]">{number}</span>
      <span className="display-sm text-[clamp(22px,2.4vw,28px)]">{title}</span>
    </h2>
  );
}
