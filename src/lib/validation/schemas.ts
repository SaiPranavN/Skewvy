import { z } from 'zod';

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

export const registerSchema = z
  .object({
    displayName: displayNameSchema,
    email: emailSchema,
    pin: pinSchema,
    confirmPin: z.string(),
    turnstileToken: z.string().min(1, 'Complete the robot check.'),
    redirectTo: z.string().optional(),
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

/** A single reaction batch. Quantity is capped server-side; the client batches ~400ms of taps. */
export const MAX_BATCH_QUANTITY = 250;

export const reactionBatchSchema = z.object({
  artifactType: artifactTypeSchema,
  artifactId: z.string().min(1).max(64),
  reactionType: reactionTypeSchema,
  quantity: z.number().int().min(1).max(MAX_BATCH_QUANTITY),
  clientBatchId: z.string().min(8).max(80),
});

export const contentStatusSchema = z.enum(['draft', 'published', 'archived']);

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
  status: contentStatusSchema.default('draft'),
  entityIds: z.array(z.string().min(1)).max(12).default([]),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ReactionBatchInput = z.infer<typeof reactionBatchSchema>;
export type EntityInput = z.infer<typeof entityInputSchema>;
export type FlashNewsInput = z.infer<typeof flashNewsInputSchema>;
