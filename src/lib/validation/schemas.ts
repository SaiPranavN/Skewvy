import { z } from 'zod';
import { REPORT_REASONS, REPORT_DETAILS_MAX_LENGTH } from '@/lib/domain/reports';
import { DETAILS_MAX, DETAIL_LABEL_MAX, DETAIL_VALUE_MAX } from '@/lib/domain/details';
import { SITE_REPORT_REASONS, EDITORIAL_STATUSES } from '@/lib/domain/site-reports';

/** Shared by the client forms and the route handlers so rules can never drift. */

export const PIN_MIN_LENGTH = 6;
export const PIN_MAX_LENGTH = 64;

export const pinSchema = z
  .string()
  .min(PIN_MIN_LENGTH, `PIN must be at least ${PIN_MIN_LENGTH} characters.`)
  .max(PIN_MAX_LENGTH, `PIN must be ${PIN_MAX_LENGTH} characters or fewer.`)
  .refine((value) => !/^(.)\1+$/.test(value), 'PIN cannot be the same character repeated.')
  .refine((value) => !/^(?:012345|123456|1234567|12345678|654321|000000)$/.test(value), 'That PIN is too easy to guess.');

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid email address.');

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Display name must be at least 2 characters.')
  .max(40, 'Display name must be 40 characters or fewer.');

/** Step one of sign-up: who you are and where to reach you. No PIN yet. */
export const registerSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  turnstileToken: z.string().min(1, 'Complete the robot check.'),
  redirectTo: z.string().optional(),
});

/** Step two, reached only through the emailed link: choose the PIN. */
export const completeRegistrationSchema = z
  .object({
    token: z.string().min(10),
    pin: pinSchema,
    confirmPin: z.string(),
    turnstileToken: z.string().min(1, 'Complete the robot check.'),
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: 'The two PINs do not match.',
    path: ['confirmPin'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  pin: z.string().min(1, 'Enter your PIN.'),
  turnstileToken: z.string().min(1, 'Complete the robot check.'),
  redirectTo: z.string().optional(),
});

export const requestPinResetSchema = z.object({
  email: emailSchema,
  turnstileToken: z.string().min(1, 'Complete the robot check.'),
});

export const resetPinSchema = z
  .object({
    token: z.string().min(10),
    pin: pinSchema,
    confirmPin: z.string(),
    turnstileToken: z.string().min(1, 'Complete the robot check.'),
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: 'The two PINs do not match.',
    path: ['confirmPin'],
  });

/** Reset without an emailed link, for deployments with no mail transport. */
export const directResetPinSchema = z
  .object({
    email: emailSchema,
    pin: pinSchema,
    confirmPin: z.string(),
    turnstileToken: z.string().min(1, 'Complete the robot check.'),
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: 'The two PINs do not match.',
    path: ['confirmPin'],
  });

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const artifactTypeSchema = z.enum(['entity', 'flash_news']);
export const reactionTypeSchema = z.enum(['rotten_egg', 'medal']);
export const stanceSchema = z.enum(['positive', 'negative']);

/** Changing sides on an Entity. Whether the type allows it is the service's call. */
export const opinionSwitchSchema = z.object({
  artifactType: artifactTypeSchema,
  artifactId: z.string().min(1).max(64),
  stance: stanceSchema,
});

/** A single reaction batch. Quantity is capped server-side; the client batches ~400ms of taps. */
export const MAX_BATCH_QUANTITY = 250;

export const reactionBatchSchema = z.object({
  artifactType: artifactTypeSchema,
  artifactId: z.string().min(1).max(64),
  reactionType: reactionTypeSchema,
  quantity: z.number().int().min(1).max(MAX_BATCH_QUANTITY),
  clientBatchId: z.string().min(8).max(80),
});

/** Comments are open to anyone signed in, whether or not they have reacted. */
export const COMMENT_MAX_LENGTH = 1000;

export const commentInputSchema = z.object({
  artifactType: artifactTypeSchema,
  artifactId: z.string().min(1).max(64),
  body: z
    .string()
    .trim()
    .min(2, 'Write at least a couple of characters.')
    .max(COMMENT_MAX_LENGTH, `Comments are limited to ${COMMENT_MAX_LENGTH} characters.`),
});

/** 1 likes, -1 dislikes, 0 withdraws. Sending the current value also withdraws it. */
export const commentVoteSchema = z.object({
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});

/** "Something else" needs the few words that say what; the listed reasons speak for themselves. */
export const commentReportSchema = z
  .object({
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(REPORT_DETAILS_MAX_LENGTH).optional(),
  })
  .refine((value) => value.reason !== 'other' || (value.details?.length ?? 0) >= 3, {
    message: 'Say briefly what is wrong with this comment.',
    path: ['details'],
  });

/** A web address someone typed. Only http(s), so nothing odd is stored as a "link". */
const webUrl = z
  .string()
  .trim()
  .max(600)
  .refine((value) => /^https?:\/\/\S+$/i.test(value), 'Enter a full web address, starting with https://');

/** The public report form. The page URL is required; how to reach the reporter is not. */
export const siteReportSchema = z.object({
  targetUrl: webUrl,
  reason: z.enum(SITE_REPORT_REASONS, { message: 'Choose a reason.' }),
  details: z.string().trim().min(10, 'Tell us a little more — at least a sentence.').max(3000),
  evidenceUrl: z.union([webUrl, z.literal('')]).optional(),
  contactEmail: z.union([emailSchema, z.literal('')]).optional(),
  turnstileToken: z.string().min(1, 'Complete the robot check.'),
});

export const editorialStatusSchema = z.union([z.enum(EDITORIAL_STATUSES), z.literal(''), z.null()]).optional();

export const contentStatusSchema = z.enum(['draft', 'published', 'archived']);

/** Editor-entered facts. Blank rows are dropped before this sees them. */
export const detailsSchema = z
  .array(
    z.object({
      label: z.string().trim().min(1).max(DETAIL_LABEL_MAX),
      value: z.string().trim().min(1).max(DETAIL_VALUE_MAX),
    }),
  )
  .max(DETAILS_MAX, `Up to ${DETAILS_MAX} details.`)
  .default([]);

export const entityInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may contain lowercase letters, numbers and hyphens only.'),
  description: z.string().trim().max(600).default(''),
  category: z.string().trim().min(2).max(40),
  imageUrl: z.string().trim().max(600).optional().nullable(),
  accent: z.string().trim().max(20).optional().nullable(),
  details: detailsSchema,
  status: contentStatusSchema.default('draft'),
});

export const flashNewsInputSchema = z.object({
  headline: z.string().trim().min(4).max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may contain lowercase letters, numbers and hyphens only.'),
  summary: z.string().trim().max(400).default(''),
  body: z.string().trim().max(6000).default(''),
  category: z.string().trim().min(2).max(40),
  imageUrl: z.string().trim().max(600).optional().nullable(),
  accent: z.string().trim().max(20).optional().nullable(),
  sourceLabel: z.string().trim().max(120).optional().nullable(),
  sourceUrl: z.string().trim().max(600).optional().nullable(),
  editorialStatus: editorialStatusSchema,
  details: detailsSchema,
  status: contentStatusSchema.default('draft'),
  entityIds: z.array(z.string().min(1)).max(12).default([]),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type CompleteRegistrationInput = z.infer<typeof completeRegistrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ReactionBatchInput = z.infer<typeof reactionBatchSchema>;
export type EntityInput = z.input<typeof entityInputSchema>;
export type FlashNewsInput = z.input<typeof flashNewsInputSchema>;
