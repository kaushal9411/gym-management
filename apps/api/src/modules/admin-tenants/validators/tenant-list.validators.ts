import { z } from 'zod';

import { TENANT_SORTS, TENANT_VIEWS } from '../utils/tenant-list.util';

import { tagSchema } from './tenant-detail.validators';

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Invalid date');

const filterShape = {
  search: z.string().trim().max(100).optional(),
  status: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED']).optional(),
  plan: z.string().trim().min(1).max(80).optional(),
  country: z.string().trim().min(1).max(100).optional(),
  createdFrom: dateStr.optional(),
  createdTo: dateStr.optional(),
  health: z.enum(['at_risk', 'fair', 'healthy']).optional(),
  view: z.enum(TENANT_VIEWS).optional(),
  tag: tagSchema.optional(),
  sort: z.enum(TENANT_SORTS).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
};

export const tenantListQuerySchema = z.object({
  ...filterShape,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const tenantExportQuerySchema = z.object(filterShape);

export const BULK_ACTIONS = [
  'extend-trial',
  'change-plan',
  'maintenance',
  'suspend',
  'reactivate',
  'force-logout',
] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

export const tenantBulkBodySchema = z
  .object({
    action: z.enum(BULK_ACTIONS),
    tenantIds: z.array(z.string().uuid()).min(1).max(100),
    params: z
      .object({
        days: z.number().int().min(1).max(90).optional(),
        reason: z.string().trim().max(200).optional(),
        planId: z.string().uuid().optional(),
        mode: z.enum(['manual', 'payment_link']).optional(),
        enabled: z.boolean().optional(),
        paymentMode: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER']).optional(),
        paymentDate: dateStr.optional(),
        notes: z.string().trim().max(2000).optional(),
      })
      .default({}),
  })
  .superRefine((b, ctx) => {
    const need = (ok: boolean, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['params', path], message });
    };
    if (b.action === 'extend-trial')
      need(b.params.days !== undefined, 'days', 'days (1-90) is required');
    if (b.action === 'change-plan') need(!!b.params.planId, 'planId', 'planId is required');
    if (b.action === 'maintenance')
      need(b.params.enabled !== undefined, 'enabled', 'enabled is required');
  });
