import { z } from 'zod';

import { LIMIT_KEYS, LIMIT_MAX_VALUE } from '../utils/tenant-limits.util';
import { REPORT_RANGES } from '../utils/tenant-reports.util';

const page = z.coerce.number().int().min(1, 'page must be 1 or more').default(1);
const limit = (max: number, def: number) =>
  z.coerce
    .number()
    .int()
    .min(1, 'limit must be at least 1')
    .max(max, `limit cannot exceed ${max}`)
    .default(def);

export const reportsQuerySchema = z.object({
  range: z
    .enum(REPORT_RANGES, { message: `range must be one of ${REPORT_RANGES.join(', ')}` })
    .default('30d'),
  compare: z
    .enum(['true', 'false'], { message: 'compare must be true or false' })
    .default('true')
    .transform((v) => v === 'true'),
});

const limitValue = z
  .number({ message: 'Each override must be a whole number (or null to clear it)' })
  .int('Each override must be a whole number')
  .min(0, 'Overrides cannot be negative')
  .max(LIMIT_MAX_VALUE, `Overrides cannot exceed ${LIMIT_MAX_VALUE}`)
  .nullable();

export const limitsBodySchema = z.object({
  overrides: z
    .record(z.string(), limitValue, {
      message: 'overrides must be an object of { limitKey: number | null }',
    })
    .superRefine((value, ctx) => {
      const keys = Object.keys(value);
      if (keys.length === 0)
        ctx.addIssue({ code: 'custom', message: 'Provide at least one override' });
      for (const k of keys) {
        if (!(LIMIT_KEYS as readonly string[]).includes(k)) {
          ctx.addIssue({
            code: 'custom',
            message: `Unknown limit "${k}". Valid keys: ${LIMIT_KEYS.join(', ')}`,
          });
        }
      }
    }),
});

export const moduleKeyParamSchema = z.object({
  tenantId: z.string().uuid(),
  key: z.string().regex(/^[a-z][a-z0-9_]{0,59}$/, 'Invalid module key'),
});

export const moduleBodySchema = z.object({
  enabled: z.boolean({ message: 'enabled must be true or false' }),
});

export const notificationChannelParamSchema = z.object({
  tenantId: z.string().uuid(),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP'], {
    message: 'channel must be one of EMAIL, SMS, WHATSAPP',
  }),
});

export const notificationChannelBodySchema = z.object({
  enabled: z.boolean({ message: 'enabled must be true or false' }),
  monthlyLimit: z
    .number({ message: 'monthlyLimit must be a whole number (or null for unlimited)' })
    .int('monthlyLimit must be a whole number')
    .min(0, 'monthlyLimit cannot be negative')
    .max(LIMIT_MAX_VALUE, `monthlyLimit cannot exceed ${LIMIT_MAX_VALUE}`)
    .nullable(),
});

export const NOTE_MAX_LENGTH = 2000;
export const noteBodySchema = z.object({
  body: z
    .string({ message: 'Note text is required' })
    .trim()
    .min(1, 'Note text is required')
    .max(NOTE_MAX_LENGTH, `Notes are limited to ${NOTE_MAX_LENGTH} characters`),
});

export const noteIdParamSchema = z.object({
  tenantId: z.string().uuid(),
  noteId: z.string().uuid(),
});

export const TAG_MAX_COUNT = 10;
export const TAG_MAX_LENGTH = 24;
export const tagSchema = z
  .string({ message: 'Each tag must be text' })
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9-]*$/,
    'Tags may only contain lowercase letters, numbers and hyphens, and must start with a letter or number',
  )
  .max(TAG_MAX_LENGTH, `Tags are limited to ${TAG_MAX_LENGTH} characters`);

export const tagsBodySchema = z.object({
  tags: z
    .array(tagSchema, { message: 'tags must be a list of strings' })
    .max(TAG_MAX_COUNT, `A tenant can have at most ${TAG_MAX_COUNT} tags`)
    .transform((tags) => [...new Set(tags)]),
});

export const usersQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z
    .enum(['PENDING_VERIFICATION', 'ACTIVE', 'LOCKED', 'SUSPENDED', 'DEACTIVATED'])
    .optional(),
  page,
  limit: limit(100, 50),
});

const dateInput = (field: string) =>
  z
    .string()
    .trim()
    .refine(
      (v) => !Number.isNaN(Date.parse(v)),
      `${field} must be a valid date (YYYY-MM-DD or ISO timestamp)`,
    )
    .transform((v) => new Date(v));

export const activityQuerySchema = z
  .object({
    action: z.string().trim().max(80).optional(),
    actor: z.string().trim().max(120).optional(),
    from: dateInput('from').optional(),
    to: dateInput('to').optional(),
    page,
    limit: limit(100, 25),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: 'from must be before to',
    path: ['from'],
  });

export const ticketsQuerySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  page,
  limit: limit(100, 20),
});
