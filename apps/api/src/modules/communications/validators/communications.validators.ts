import { z } from 'zod';

import { AUTOMATION_KEYS, AUTOMATION_RULES, allowedPlaceholdersFor, type AutomationRuleDef } from '../constants/automation-rules';
import {
  ALL_CHANNELS,
  BODY_MAX,
  MAX_FILTER_IDS,
  MAX_PICKED_IDS,
  MAX_SCHEDULE_DAYS,
  MIN_SCHEDULE_LEAD_MS,
  NAME_MAX,
  OPT_OUT_CHANNELS,
  SMS_TEXT_MAX,
  TEST_SEND_CHANNELS,
  TITLE_MAX,
} from '../constants/limits';
import { CAMPAIGN_PLACEHOLDERS, findPlaceholderIssues, renderPlaceholders, SAMPLE_VARS } from '../utils/placeholder.util';

export const channelEnum = z.enum(ALL_CHANNELS as unknown as [string, ...string[]]);
export type ChannelInput = 'PUSH' | 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';

const uniqueChannels = z
  .array(channelEnum)
  .min(1, 'Choose at least one channel.')
  .max(ALL_CHANNELS.length)
  .refine((v) => new Set(v).size === v.length, 'Each channel can only be listed once.') as unknown as z.ZodType<ChannelInput[]>;

const uuid = z.string().uuid();
const idList = z.array(uuid).min(1).max(MAX_FILTER_IDS);

export const audienceFilterSchema = z
  .object({
    membershipStatus: z.enum(['ACTIVE', 'EXPIRING', 'EXPIRED', 'FROZEN', 'NO_PLAN']).optional(),
    expiringWithinDays: z.number().int().min(1).max(90).optional(),
    planIds: idList.optional(),
    branchIds: idList.optional(),
    trainerIds: idList.optional(),
    hasTrainer: z.boolean().optional(),
    hasOverdueInvoice: z.boolean().optional(),
    hasUnpaidInvoice: z.boolean().optional(),
    notVisitedDays: z.number().int().min(1).max(365).optional(),
    birthdayThisWeek: z.boolean().optional(),
    bookedClassSessionId: uuid.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.expiringWithinDays !== undefined && v.membershipStatus !== 'EXPIRING') {
      ctx.addIssue({ code: 'custom', path: ['expiringWithinDays'], message: 'expiringWithinDays only applies when membershipStatus is EXPIRING.' });
    }
  });
export type AudienceFilterInput = z.infer<typeof audienceFilterSchema>;

const pickedIds = z
  .array(uuid)
  .min(1, 'Pick at least one member.')
  .max(MAX_PICKED_IDS, `You can pick at most ${MAX_PICKED_IDS} members.`)
  .transform((ids) => [...new Set(ids)]);

const audienceMode = z.enum(['FILTERS', 'PICKED']);

const titleSchema = z.string().trim().min(1, 'Title is required.').max(TITLE_MAX, `Title can be at most ${TITLE_MAX} characters.`);
const bodySchema = z.string().trim().min(1, 'Message is required.').max(BODY_MAX, `Message can be at most ${BODY_MAX} characters.`);
const nameSchema = z.string().trim().min(1).max(NAME_MAX);
const templateKey = z.enum([
  'CUSTOM',
  'MEMBERSHIP_EXPIRING',
  'PAYMENT_OVERDUE',
  'CLASS_UPDATE',
  'SPECIAL_OFFER',
  'WINTER_OFFER',
  'SUMMER_OFFER',
  'FESTIVE_OFFER',
  'RENEWAL_OFFER',
  'REFER_FRIEND',
  'COMEBACK_OFFER',
  'HOLIDAY_NOTICE',
  'TIMING_CHANGE',
  'FEEDBACK_REQUEST',
]);
const isoDateTime = z.string().datetime({ offset: true, message: 'scheduledAt must be an ISO-8601 date-time.' });

/** Text-level rules shared by create/update/test-send: placeholders and SMS length. */
export function messageIssues(title: string, body: string, channels: readonly string[]): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];
  for (const m of findPlaceholderIssues(title, CAMPAIGN_PLACEHOLDERS)) issues.push({ path: 'title', message: m });
  for (const m of findPlaceholderIssues(body, CAMPAIGN_PLACEHOLDERS)) issues.push({ path: 'body', message: m });
  if (channels.includes('SMS')) {
    const sample = renderPlaceholders(`${title}\n${body}`, SAMPLE_VARS);
    if (sample.length > SMS_TEXT_MAX) {
      issues.push({ path: 'body', message: `For SMS the title and message together can be at most ${SMS_TEXT_MAX} characters (yours is about ${sample.length}). Shorten it or turn SMS off.` });
    }
  }
  return issues;
}

/** Schedule window rule: at least 1 minute ahead and at most 90 days. */
export function scheduleIssue(scheduledAt: string, now = new Date()): string | null {
  const t = Date.parse(scheduledAt);
  if (Number.isNaN(t)) return 'scheduledAt must be a valid date-time.';
  if (t < now.getTime() + MIN_SCHEDULE_LEAD_MS) return 'scheduledAt must be in the future (at least a minute from now).';
  if (t > now.getTime() + MAX_SCHEDULE_DAYS * 86_400_000) return `scheduledAt can be at most ${MAX_SCHEDULE_DAYS} days ahead.`;
  return null;
}

export const createCampaignSchema = z
  .object({
    name: nameSchema.optional(),
    title: titleSchema,
    body: bodySchema,
    channels: uniqueChannels,
    audienceMode,
    audienceFilter: audienceFilterSchema.optional(),
    pickedMemberIds: pickedIds.optional(),
    templateKey: templateKey.optional(),
    sendMode: z.enum(['NOW', 'SCHEDULE', 'DRAFT']).default('NOW'),
    scheduledAt: isoDateTime.optional(),
    holdQuietHours: z.boolean().default(true),
    confirmLargeSend: z.boolean().default(false),
  })
  .strict()
  .superRefine((v, ctx) => {
    for (const i of messageIssues(v.title, v.body, v.channels)) ctx.addIssue({ code: 'custom', path: [i.path], message: i.message });
    if (v.audienceMode === 'PICKED' && !v.pickedMemberIds) ctx.addIssue({ code: 'custom', path: ['pickedMemberIds'], message: 'Pick at least one member.' });
    if (v.audienceMode === 'FILTERS' && v.pickedMemberIds) ctx.addIssue({ code: 'custom', path: ['pickedMemberIds'], message: 'pickedMemberIds can only be used with audienceMode PICKED.' });
    if (v.audienceMode === 'PICKED' && v.audienceFilter && Object.keys(v.audienceFilter).length) {
      ctx.addIssue({ code: 'custom', path: ['audienceFilter'], message: 'audienceFilter cannot be combined with audienceMode PICKED.' });
    }
    if (v.sendMode === 'SCHEDULE' && !v.scheduledAt) ctx.addIssue({ code: 'custom', path: ['scheduledAt'], message: 'Choose when to send (scheduledAt is required to schedule).' });
    if (v.sendMode === 'NOW' && v.scheduledAt) ctx.addIssue({ code: 'custom', path: ['scheduledAt'], message: 'scheduledAt cannot be used with sendMode NOW.' });
    if (v.scheduledAt) {
      const problem = scheduleIssue(v.scheduledAt);
      if (problem) ctx.addIssue({ code: 'custom', path: ['scheduledAt'], message: problem });
    }
  });
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = z
  .object({
    name: nameSchema,
    title: titleSchema,
    body: bodySchema,
    channels: uniqueChannels,
    audienceMode,
    audienceFilter: audienceFilterSchema,
    pickedMemberIds: pickedIds,
    templateKey,
    scheduledAt: isoDateTime,
    holdQuietHours: z.boolean(),
    confirmLargeSend: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update.' })
  .superRefine((v, ctx) => {
    if (v.title !== undefined) for (const m of findPlaceholderIssues(v.title, CAMPAIGN_PLACEHOLDERS)) ctx.addIssue({ code: 'custom', path: ['title'], message: m });
    if (v.body !== undefined) for (const m of findPlaceholderIssues(v.body, CAMPAIGN_PLACEHOLDERS)) ctx.addIssue({ code: 'custom', path: ['body'], message: m });
    if (v.scheduledAt) {
      const problem = scheduleIssue(v.scheduledAt);
      if (problem) ctx.addIssue({ code: 'custom', path: ['scheduledAt'], message: problem });
    }
  });
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

export const sendCampaignSchema = z.object({ confirmLargeSend: z.boolean().default(false) }).strict();

export const idParamSchema = z.object({ id: uuid });

export const listCampaignsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PARTIAL', 'FAILED', 'CANCELLED']).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const recipientsQuerySchema = z.object({
  status: z.enum(['QUEUED', 'SENT', 'FAILED', 'SKIPPED_OPTED_OUT', 'SKIPPED_NO_CONTACT', 'SKIPPED_QUOTA', 'SKIPPED_DISABLED', 'CANCELLED']).optional(),
  channel: channelEnum.optional(),
  search: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const audienceMembersQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  branchId: uuid.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const previewSchema = z
  .object({
    audienceMode,
    audienceFilter: audienceFilterSchema.optional(),
    pickedMemberIds: pickedIds.optional(),
    channels: uniqueChannels.optional(),
    title: z.string().max(TITLE_MAX).optional(),
    body: z.string().max(BODY_MAX).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.audienceMode === 'PICKED' && !v.pickedMemberIds) ctx.addIssue({ code: 'custom', path: ['pickedMemberIds'], message: 'Pick at least one member.' });
    if (v.audienceMode === 'FILTERS' && v.pickedMemberIds) ctx.addIssue({ code: 'custom', path: ['pickedMemberIds'], message: 'pickedMemberIds can only be used with audienceMode PICKED.' });
  });
export type PreviewInput = z.infer<typeof previewSchema>;

const testChannels = z
  .array(z.enum(TEST_SEND_CHANNELS))
  .min(1, 'Choose at least one channel.')
  .refine((v) => new Set(v).size === v.length, 'Each channel can only be listed once.');

export const testSendSchema = z
  .object({ title: titleSchema, body: bodySchema, channels: testChannels })
  .strict()
  .superRefine((v, ctx) => {
    for (const i of messageIssues(v.title, v.body, v.channels)) ctx.addIssue({ code: 'custom', path: [i.path], message: i.message });
  });
export type TestSendInput = z.infer<typeof testSendSchema>;

export const automationKeyParamSchema = z.object({ key: z.enum(AUTOMATION_KEYS as unknown as [string, ...string[]]) });

export const putAutomationSchema = z
  .object({
    enabled: z.boolean(),
    offsets: z.array(z.number().int()).max(10).optional(),
    channels: uniqueChannels,
    title: z.string().trim().min(1).max(TITLE_MAX).nullable().optional(),
    body: z.string().trim().min(1).max(BODY_MAX).nullable().optional(),
  })
  .strict();
export type PutAutomationInput = z.infer<typeof putAutomationSchema>;

export const testAutomationSchema = z.object({ channels: testChannels.optional() }).strict();

/** Rule-specific checks that depend on `:key` (offset ranges, fixed timing, channel/placeholder allow-lists). */
export function automationIssues(def: AutomationRuleDef, input: PutAutomationInput): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];
  if (def.editable) {
    if (!input.offsets || input.offsets.length === 0) {
      issues.push({ path: 'offsets', message: 'Choose when to send (at least one timing).' });
    } else {
      if (input.offsets.length > def.maxCount) issues.push({ path: 'offsets', message: `At most ${def.maxCount} timing${def.maxCount === 1 ? '' : 's'} for ${def.label}.` });
      if (new Set(input.offsets).size !== input.offsets.length) issues.push({ path: 'offsets', message: 'Each timing can only be listed once.' });
      for (const n of input.offsets) {
        if (n < def.min || n > def.max) issues.push({ path: 'offsets', message: `Timings for ${def.label} must be between ${def.min} and ${def.max}.` });
      }
    }
  } else if (input.offsets !== undefined) {
    issues.push({ path: 'offsets', message: `${def.label} has a fixed timing - leave offsets out.` });
  }
  if (input.enabled && input.channels.length === 0) issues.push({ path: 'channels', message: 'Choose at least one channel to switch this rule on.' });
  const allowed = allowedPlaceholdersFor(def);
  if (input.title) for (const m of findPlaceholderIssues(input.title, allowed)) issues.push({ path: 'title', message: m });
  if (input.body) for (const m of findPlaceholderIssues(input.body, allowed)) issues.push({ path: 'body', message: m });
  return issues;
}

export function ruleDefFor(key: string): AutomationRuleDef {
  return AUTOMATION_RULES[key as keyof typeof AUTOMATION_RULES];
}

export const memberPreferencesSchema = z
  .object({
    channels: z
      .array(z.object({ channel: z.enum(OPT_OUT_CHANNELS), promotionalOptOut: z.boolean() }).strict())
      .min(1)
      .max(OPT_OUT_CHANNELS.length)
      .refine((v) => new Set(v.map((c) => c.channel)).size === v.length, 'Each channel can only be listed once.'),
  })
  .strict();
export type MemberPreferencesInput = z.infer<typeof memberPreferencesSchema>;
