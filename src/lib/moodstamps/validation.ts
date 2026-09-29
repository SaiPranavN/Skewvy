import { z } from 'zod';
import {
  EMOTION_MAX,
  EMOTION_MIN,
  QUANTITY_MAX,
  QUANTITY_MIN,
  REASON_LIMITS,
  REASON_MIN,
  RECIPIENT_NAME_MAX,
} from './catalog';
import { moderateText, moderationMessage } from './moderation';

/**
 * The rules for a MoodStamp, shared by the form and the API so they cannot
 * drift. The form uses them to guide as the sender types; the route handler
 * uses them to refuse anything that got past the form.
 */

/** Every free-text field on a MoodStamp, in the order the form asks for them. */
export const MOODSTAMP_TEXT_FIELDS = ['emotion', 'reasonWhat', 'reasonImpact', 'reasonRequest', 'recipientName'] as const;
export type MoodStampTextField = (typeof MOODSTAMP_TEXT_FIELDS)[number];

/** Any text a person typed, checked for language a MoodStamp cannot carry. */
function clean(schema: z.ZodString) {
  return schema.superRefine((value, context) => {
    const message = moderationMessage(moderateText(value));
    if (message) context.addIssue({ code: 'custom', message });
  });
}

function reason(max: number, label: string) {
  return clean(
    z
      .string()
      .trim()
      .min(REASON_MIN, `Add a few words about ${label}.`)
      .max(max, `Keep this to ${max} characters — it has to fit on the stamp.`),
  );
}

export const moodStampDraftSchema = z.object({
  reaction: z.enum(['medal', 'rotten_egg'], { error: 'Choose Medals or Rotten Eggs.' }),
  emotion: clean(
    z
      .string()
      .trim()
      .min(EMOTION_MIN, 'Name the feeling.')
      .max(EMOTION_MAX, `Keep the feeling to ${EMOTION_MAX} characters.`)
      .regex(/^[\p{L}][\p{L}' -]*$/u, 'Use letters only — one or two words.')
      .refine((value) => value.split(/\s+/).length <= 3, 'Keep the feeling to one or two words.'),
  ),
  quantity: z
    .number({ error: 'Choose how many.' })
    .int('Choose a whole number.')
    .min(QUANTITY_MIN, `Send at least ${QUANTITY_MIN}.`)
    .max(QUANTITY_MAX, `${QUANTITY_MAX} is the most one MoodStamp can carry.`),
  reasonWhat: reason(REASON_LIMITS[0], 'what happened'),
  reasonImpact: reason(REASON_LIMITS[1], 'how it affected you'),
  reasonRequest: reason(REASON_LIMITS[2], 'what you want them to know'),
  recipientName: clean(
    z
      .string()
      .trim()
      .min(1, 'Who is it for?')
      .max(RECIPIENT_NAME_MAX, `Keep the name to ${RECIPIENT_NAME_MAX} characters.`),
  ),
  anonymous: z.boolean(),
});

export type MoodStampDraft = z.infer<typeof moodStampDraftSchema>;

/** Digits only, with the country code: +919876543210. */
export const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export function normalisePhone(countryCode: string, number: string): string {
  const digits = number.replace(/\D/g, '').replace(/^0+/, '');
  return `${countryCode}${digits}`;
}

export const moodStampDeliverySchema = z.discriminatedUnion('channel', [
  z.object({
    channel: z.literal('email'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter a valid email address.'),
  }),
  z.object({
    channel: z.literal('whatsapp'),
    phone: z.string().trim().regex(PHONE_PATTERN, 'Enter the number with its country code, like +91 98765 43210.'),
  }),
  z.object({ channel: z.literal('download') }),
]);

export type MoodStampDelivery = z.infer<typeof moodStampDeliverySchema>;

export const moodStampCreateSchema = z.object({
  draft: moodStampDraftSchema,
  delivery: moodStampDeliverySchema,
});

/** Per-field messages for the form, keyed by field name. Empty when the draft is sendable. */
export function draftErrors(draft: unknown): Partial<Record<keyof MoodStampDraft, string>> {
  const result = moodStampDraftSchema.safeParse(draft);
  if (result.success) return {};
  const errors: Partial<Record<keyof MoodStampDraft, string>> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof MoodStampDraft;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
