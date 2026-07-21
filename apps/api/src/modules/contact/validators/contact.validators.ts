import { z } from 'zod';

import { emailSchema } from '../../authentication/validators/auth.validators';

export const contactRequestSchema = z.object({
  topic: z.enum(['sales', 'billing']).default('sales'),
  name: z.string().trim().min(2, 'Your name is required').max(120),
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  gymSlug: z.string().trim().max(60).optional(),
  message: z.string().trim().min(10, 'Tell us a little more (at least 10 characters)').max(2000),
});

export type ContactRequestInput = z.infer<typeof contactRequestSchema>;
