import { z } from 'zod';

import { emailSchema, passwordSchema } from '../../authentication/validators/auth.validators';

export const createInvitationSchema = z.object({
  email: emailSchema,
  roleId: z.string().uuid(),
  branchIds: z.array(z.string().uuid()).max(200).optional(),
});

export const listInvitationsQuerySchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const invitationIdParamSchema = z.object({
  invitationId: z.string().uuid(),
});

export const lookupInvitationQuerySchema = z.object({
  token: z.string().min(10).max(200),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(10).max(200),
  name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  password: passwordSchema,
});
