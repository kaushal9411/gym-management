import { z } from 'zod';

export const LEAD_SOURCES = ['WALK_IN', 'PHONE_CALL', 'WEBSITE', 'SOCIAL_MEDIA', 'REFERRAL', 'ADVERTISEMENT', 'OTHER'] as const;
export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'TRIAL_DONE', 'NEGOTIATION', 'CONVERTED', 'LOST'] as const;
export const LEAD_LOST_REASONS = ['PRICE_TOO_HIGH', 'NOT_INTERESTED', 'JOINED_COMPETITOR', 'LOCATION_TOO_FAR', 'TIMING_NOT_RIGHT', 'NO_RESPONSE', 'OTHER'] as const;
/** Types a user may log by hand; STATUS_CHANGE / ASSIGNMENT / CREATED / CONVERTED are system-written only. */
export const MANUAL_ACTIVITY_TYPES = ['NOTE', 'CALL', 'WHATSAPP', 'EMAIL', 'VISIT', 'TRIAL', 'FOLLOW_UP'] as const;
export const FOLLOW_UP_FILTERS = ['overdue', 'today', 'upcoming', 'none'] as const;
export const ANALYTICS_RANGES = ['today', '7d', '30d', 'month', 'year', 'custom'] as const;

const sourceSchema = z.enum(LEAD_SOURCES);
const statusSchema = z.enum(LEAD_STATUSES);
const lostReasonSchema = z.enum(LEAD_LOST_REASONS);
const genderSchema = z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']);

/** Same shape members accept, so a lead can always be converted without re-keying the number. */
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number');
const emailSchema = z.string().trim().min(1).max(200).email('Enter a valid email address').toLowerCase();
const dateTimeSchema = z.string().datetime({ offset: true });

/** Accepts `status=NEW&status=LOST` and `status=NEW,LOST`. */
const csvArray = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => {
    if (v === undefined || v === '') return undefined;
    const arr = Array.isArray(v) ? v : [v];
    return arr.flatMap((x) => (typeof x === 'string' ? x.split(',') : [x])).map((x) => (typeof x === 'string' ? x.trim() : x)).filter((x) => x !== '');
  }, z.array(item).optional());

export const idParamSchema = z.object({ id: z.string().uuid() });

export const createLeadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: phoneSchema,
  email: emailSchema.optional(),
  gender: genderSchema.optional(),
  source: sourceSchema.default('WALK_IN'),
  sourceDetail: z.string().trim().max(200).optional(),
  branchId: z.string().uuid().optional(),
  interestedPlanId: z.string().uuid().optional(),
  interest: z.string().trim().max(2000).optional(),
  /** Defaults to the creating user. Naming someone else requires `leads:assign`. */
  assignedToUserId: z.string().uuid().optional(),
  nextFollowUpAt: dateTimeSchema.optional(),
  expectedJoinDate: z.string().date().optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const updateLeadSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    phone: phoneSchema,
    email: emailSchema.nullable(),
    gender: genderSchema.nullable(),
    source: sourceSchema,
    sourceDetail: z.string().trim().max(200).nullable(),
    branchId: z.string().uuid().nullable(),
    interestedPlanId: z.string().uuid().nullable(),
    interest: z.string().trim().max(2000).nullable(),
    nextFollowUpAt: dateTimeSchema.nullable(),
    expectedJoinDate: z.string().date().nullable(),
    notes: z.string().trim().max(4000).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update.' });

export const changeStatusSchema = z
  .object({
    status: statusSchema,
    lostReason: lostReasonSchema.optional(),
    lostNote: z.string().trim().max(1000).optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.status === 'LOST' && !v.lostReason) ctx.addIssue({ code: 'custom', path: ['lostReason'], message: 'A reason is required when marking a lead as lost.' });
    if (v.status === 'CONVERTED') ctx.addIssue({ code: 'custom', path: ['status'], message: 'Use POST /leads/:id/convert to convert a lead into a member.' });
  });

export const assignLeadSchema = z.object({ assignedToUserId: z.string().uuid().nullable() });

export const addActivitySchema = z
  .object({
    type: z.enum(MANUAL_ACTIVITY_TYPES),
    note: z.string().trim().max(2000).optional(),
    outcome: z.string().trim().max(120).optional(),
    scheduledFor: dateTimeSchema.optional(),
    nextFollowUpAt: dateTimeSchema.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'NOTE' && !v.note) ctx.addIssue({ code: 'custom', path: ['note'], message: 'A note is required.' });
    if (v.type === 'FOLLOW_UP' && !v.scheduledFor && !v.nextFollowUpAt && !v.note) {
      ctx.addIssue({ code: 'custom', path: ['scheduledFor'], message: 'Provide scheduledFor (or a note) for a follow-up.' });
    }
  });

export const convertLeadSchema = z.object({
  /** Required when the lead has no branch of its own. */
  branchId: z.string().uuid().optional(),
  /** Needed only when the lead's name is a single word. */
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  /** Optional: assign this membership plan right away. */
  planId: z.string().uuid().optional(),
  startDate: z.string().date().optional(),
  dateOfBirth: z.string().date().optional(),
  trainerId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
});

const listFilterFields = {
  search: z.string().trim().max(120).optional(),
  status: csvArray(statusSchema),
  source: csvArray(sourceSchema),
  /** A user id, `me` (the caller), or `unassigned`. */
  assignedTo: z.union([z.string().uuid(), z.literal('me'), z.literal('unassigned')]).optional(),
  branchId: z.string().uuid().optional(),
  interestedPlanId: z.string().uuid().optional(),
  createdFrom: z.string().date().optional(),
  createdTo: z.string().date().optional(),
  followUp: z.enum(FOLLOW_UP_FILTERS).optional(),
};

export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  ...listFilterFields,
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'nextFollowUpAt', 'lastActivityAt', 'expectedJoinDate']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const exportLeadsQuerySchema = z.object({ ...listFilterFields });

export const followUpsQuerySchema = z.object({
  /** `mine` = leads assigned to the caller (default); `all` = every lead in the caller's branch scope. */
  scope: z.enum(['mine', 'all']).default('mine'),
  /** `due` = overdue + today (default). */
  bucket: z.enum(['due', 'overdue', 'today', 'upcoming']).default('due'),
  branchId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const leadAnalyticsQuerySchema = z
  .object({
    range: z.enum(ANALYTICS_RANGES).default('30d'),
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
    branchId: z.string().uuid().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.range === 'custom') {
      if (!v.dateFrom || !v.dateTo) ctx.addIssue({ code: 'custom', path: ['dateFrom'], message: 'dateFrom and dateTo are required for a custom range.' });
      else {
        const days = (Date.parse(v.dateTo) - Date.parse(v.dateFrom)) / 86_400_000 + 1;
        if (days < 1) ctx.addIssue({ code: 'custom', path: ['dateTo'], message: 'dateTo must be on or after dateFrom.' });
        if (days > 366) ctx.addIssue({ code: 'custom', path: ['dateTo'], message: 'A custom range can span at most 366 days.' });
      }
    }
  });

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
export type AssignLeadInput = z.infer<typeof assignLeadSchema>;
export type AddActivityInput = z.infer<typeof addActivitySchema>;
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
export type ExportLeadsQuery = z.infer<typeof exportLeadsQuerySchema>;
export type FollowUpsQuery = z.infer<typeof followUpsQuerySchema>;
export type LeadAnalyticsQuery = z.infer<typeof leadAnalyticsQuerySchema>;
export type LeadSourceValue = (typeof LEAD_SOURCES)[number];
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];
