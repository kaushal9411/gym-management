import { z } from 'zod';

import { emailSchema } from '../../authentication/validators/auth.validators';

export const CONTACT_TOPICS = ['sales', 'billing', 'demo', 'general'] as const;
export const CONTACT_SOURCES = ['HOME_PAGE', 'STATUS_SCREEN'] as const;
export const GYM_SIZES = ['under-100', '100-300', '300-1000', 'over-1000'] as const;

/** Optional text that arrives as an empty string from an untouched form field. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length > 0 ? v : undefined))
    .optional();

export const contactRequestSchema = z.object({
  topic: z.enum(CONTACT_TOPICS).default('sales'),
  name: z.string().trim().min(2, 'Your name is required').max(120),
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  gymName: optionalText(120),
  gymSlug: optionalText(60),
  gymSize: z.enum(GYM_SIZES).optional().or(z.literal('').transform(() => undefined)),
  source: z.enum(CONTACT_SOURCES).default('STATUS_SCREEN'),
  message: z.string().trim().min(10, 'Tell us a little more (at least 10 characters)').max(2000),
  /** Honeypot: hidden from people, filled in by bots. A non-empty value is dropped silently. */
  website: z.string().max(200).optional(),
});

export type ContactRequestInput = z.infer<typeof contactRequestSchema>;
