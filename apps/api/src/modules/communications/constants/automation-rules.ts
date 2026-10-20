import type { AutomationRuleKey, NotificationTemplateType, TenantNotificationCategory, TenantNotificationChannel } from '@prisma/client';

import { ALL_CHANNELS } from './limits';

export type TimingUnit = 'DAYS_BEFORE' | 'DAYS_AFTER' | 'HOURS_BEFORE' | 'DAYS_SINCE_VISIT' | 'ON_DAY' | 'EVENT';
/** TRANSACTIONAL = about the member's own membership/payments/bookings (ignores promotional opt-out). */
export type RuleKind = 'TRANSACTIONAL' | 'PROMOTIONAL';

export interface AutomationRuleDef {
  key: AutomationRuleKey;
  label: string;
  description: string;
  kind: RuleKind;
  unit: TimingUnit;
  /** False for ON_DAY / EVENT rules — offsets are fixed. */
  editable: boolean;
  min: number;
  max: number;
  maxCount: number;
  defaultOffsets: number[];
  defaultChannels: TenantNotificationChannel[];
  defaultEnabled: boolean;
  category: TenantNotificationCategory;
  /** Legacy `NotificationTemplate` whose customised text / "inactive" switch this rule keeps honouring when it has no saved row. */
  legacyTemplate?: NotificationTemplateType;
  /** Extra placeholders available beyond the campaign set. */
  extraPlaceholders: string[];
  defaultTitle: string;
  defaultBody: string;
}

const BASE = ['firstName', 'lastName', 'memberCode', 'planName', 'endDate', 'amountDue', 'gymName'];
/** Old-style tokens the pre-existing notification templates use; accepted wherever a template-linked rule renders. */
const LEGACY = ['memberName', 'expiryStatus', 'amount', 'tenantName'];

export const AUTOMATION_KEYS: AutomationRuleKey[] = [
  'MEMBERSHIP_EXPIRING',
  'MEMBERSHIP_EXPIRED',
  'PAYMENT_OVERDUE',
  'INVOICE_DUE_SOON',
  'PAYMENT_FAILED',
  'CLASS_REMINDER',
  'CLASS_SCHEDULED_OR_CHANGED',
  'BIRTHDAY',
  'WE_MISS_YOU',
];

export const AUTOMATION_RULES: Record<AutomationRuleKey, AutomationRuleDef> = {
  MEMBERSHIP_EXPIRING: {
    key: 'MEMBERSHIP_EXPIRING',
    label: 'Membership expiring',
    description: 'Before the end date, to members with an active plan.',
    kind: 'TRANSACTIONAL',
    unit: 'DAYS_BEFORE',
    editable: true,
    min: 1,
    max: 60,
    maxCount: 5,
    defaultOffsets: [7, 3, 1],
    defaultChannels: ['PUSH', 'EMAIL'],
    defaultEnabled: true,
    category: 'MEMBERSHIP',
    legacyTemplate: 'MEMBERSHIP_EXPIRY',
    extraPlaceholders: ['daysLeft', ...LEGACY],
    defaultTitle: '{{firstName}}, your {{planName}} plan ends {{endDate}}',
    defaultBody: 'Your {{planName}} membership ends on {{endDate}} ({{daysLeft}} day(s) left). Renew at the front desk or in the app to keep your access uninterrupted.',
  },
  MEMBERSHIP_EXPIRED: {
    key: 'MEMBERSHIP_EXPIRED',
    label: 'Membership expired',
    description: 'After the end date, to members whose plan has just expired.',
    kind: 'TRANSACTIONAL',
    unit: 'DAYS_AFTER',
    editable: true,
    min: 1,
    max: 30,
    maxCount: 3,
    defaultOffsets: [1],
    defaultChannels: ['PUSH', 'EMAIL'],
    defaultEnabled: true,
    category: 'MEMBERSHIP',
    legacyTemplate: 'MEMBERSHIP_EXPIRY',
    extraPlaceholders: [...LEGACY],
    defaultTitle: '{{firstName}}, your {{planName}} plan has ended',
    defaultBody: 'Your {{planName}} membership ended on {{endDate}}. Visit the front desk or renew in the app to get back to training.',
  },
  PAYMENT_OVERDUE: {
    key: 'PAYMENT_OVERDUE',
    label: 'Payment overdue',
    description: 'After the due date, while an invoice is still unpaid.',
    kind: 'TRANSACTIONAL',
    unit: 'DAYS_AFTER',
    editable: true,
    min: 1,
    max: 60,
    maxCount: 5,
    defaultOffsets: [1, 7, 14],
    defaultChannels: ['PUSH', 'SMS'],
    defaultEnabled: true,
    category: 'PAYMENT',
    legacyTemplate: 'PAYMENT_OVERDUE',
    extraPlaceholders: ['invoiceNumber', 'dueDate'],
    defaultTitle: 'Payment overdue: {{amountDue}}',
    defaultBody: 'Hi {{firstName}}, invoice {{invoiceNumber}} of {{amountDue}} was due on {{dueDate}}. Please pay in the app or at the front desk.',
  },
  INVOICE_DUE_SOON: {
    key: 'INVOICE_DUE_SOON',
    label: 'Invoice due soon',
    description: 'Before the due date, as a friendly heads-up.',
    kind: 'TRANSACTIONAL',
    unit: 'DAYS_BEFORE',
    editable: true,
    min: 1,
    max: 30,
    maxCount: 3,
    defaultOffsets: [3],
    defaultChannels: ['PUSH', 'EMAIL'],
    defaultEnabled: true,
    category: 'PAYMENT',
    legacyTemplate: 'INVOICE_DUE_SOON',
    extraPlaceholders: ['invoiceNumber', 'dueDate', 'daysLeft'],
    defaultTitle: 'Payment due {{dueDate}}',
    defaultBody: 'Hi {{firstName}}, invoice {{invoiceNumber}} of {{amountDue}} is due on {{dueDate}}. You can pay in the app or at the front desk.',
  },
  PAYMENT_FAILED: {
    key: 'PAYMENT_FAILED',
    label: 'Payment failed',
    description: 'The morning after a payment attempt fails.',
    kind: 'TRANSACTIONAL',
    unit: 'DAYS_AFTER',
    editable: true,
    min: 1,
    max: 7,
    maxCount: 1,
    defaultOffsets: [1],
    defaultChannels: ['PUSH'],
    defaultEnabled: true,
    category: 'PAYMENT',
    legacyTemplate: 'PAYMENT_FAILED',
    extraPlaceholders: [...LEGACY],
    defaultTitle: 'Payment failed',
    defaultBody: 'Hi {{firstName}}, your payment of {{amountDue}} could not be processed. Please try again or contact the front desk.',
  },
  CLASS_REMINDER: {
    key: 'CLASS_REMINDER',
    label: 'Class reminder',
    description: 'Before a class the member has booked.',
    kind: 'TRANSACTIONAL',
    unit: 'HOURS_BEFORE',
    editable: true,
    min: 1,
    max: 72,
    maxCount: 3,
    defaultOffsets: [24, 2],
    defaultChannels: ['PUSH'],
    defaultEnabled: true,
    category: 'GENERAL',
    legacyTemplate: 'CLASS_REMINDER',
    extraPlaceholders: ['className', 'classDate', 'classTime'],
    defaultTitle: 'Class reminder: {{className}}',
    defaultBody: 'Hi {{firstName}}, {{className}} starts on {{classDate}} at {{classTime}}. See you there!',
  },
  CLASS_SCHEDULED_OR_CHANGED: {
    key: 'CLASS_SCHEDULED_OR_CHANGED',
    label: 'Class scheduled or changed',
    description: 'When a class timetable changes or a class is cancelled (booked members) and when a new class is announced (members of its branch).',
    kind: 'TRANSACTIONAL',
    unit: 'EVENT',
    editable: false,
    min: 0,
    max: 0,
    maxCount: 0,
    defaultOffsets: [],
    defaultChannels: ['PUSH', 'IN_APP'],
    defaultEnabled: true,
    category: 'GENERAL',
    legacyTemplate: 'CLASS_SCHEDULED_OR_CHANGED',
    extraPlaceholders: ['className'],
    defaultTitle: 'Class update: {{className}}',
    defaultBody: 'Hi {{firstName}}, there is an update to {{className}}. Open the app to see the latest timetable.',
  },
  BIRTHDAY: {
    key: 'BIRTHDAY',
    label: 'Birthday',
    description: 'On the member birthday.',
    kind: 'PROMOTIONAL',
    unit: 'ON_DAY',
    editable: false,
    min: 0,
    max: 0,
    maxCount: 0,
    defaultOffsets: [0],
    defaultChannels: ['PUSH', 'EMAIL'],
    defaultEnabled: true,
    category: 'MEMBER',
    legacyTemplate: 'BIRTHDAY_WISHES',
    extraPlaceholders: [...LEGACY],
    defaultTitle: 'Happy Birthday, {{firstName}}!',
    defaultBody: 'Wishing you a fantastic birthday from all of us at {{gymName}}. See you at the gym!',
  },
  WE_MISS_YOU: {
    key: 'WE_MISS_YOU',
    label: 'We miss you',
    description: 'After a period without a visit, to members with an active plan.',
    kind: 'PROMOTIONAL',
    unit: 'DAYS_SINCE_VISIT',
    editable: true,
    min: 7,
    max: 90,
    maxCount: 1,
    defaultOffsets: [14],
    defaultChannels: ['PUSH'],
    defaultEnabled: false,
    category: 'GENERAL',
    legacyTemplate: 'WE_MISS_YOU',
    extraPlaceholders: ['daysAway'],
    defaultTitle: 'We miss you, {{firstName}}',
    defaultBody: 'It has been a while since your last visit to {{gymName}}. Come back this week and keep your streak going!',
  },
};

export function isAutomationKey(value: string): value is AutomationRuleKey {
  return (AUTOMATION_KEYS as string[]).includes(value);
}

/** Placeholders valid for this rule's title/body overrides. */
export function allowedPlaceholdersFor(def: AutomationRuleDef): string[] {
  return [...BASE, ...def.extraPlaceholders];
}

export const ALLOWED_AUTOMATION_CHANNELS: readonly TenantNotificationChannel[] = ALL_CHANNELS;

/** The effective settings of a rule: saved row merged over the documented defaults. */
export interface EffectiveRule {
  key: AutomationRuleKey;
  def: AutomationRuleDef;
  enabled: boolean;
  offsets: number[];
  channels: TenantNotificationChannel[];
  titleOverride: string | null;
  bodyOverride: string | null;
  isDefault: boolean;
  updatedAt: Date | null;
}

export interface SavedRuleRow {
  key: AutomationRuleKey;
  enabled: boolean;
  offsets: unknown;
  channels: TenantNotificationChannel[];
  titleTemplate: string | null;
  bodyTemplate: string | null;
  updatedAt: Date;
}

function toOffsets(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) return fallback;
  const nums = value.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return nums.length ? [...nums].sort((a, b) => a - b) : fallback;
}

export function mergeRule(def: AutomationRuleDef, row: SavedRuleRow | null | undefined): EffectiveRule {
  if (!row) {
    return {
      key: def.key,
      def,
      enabled: def.defaultEnabled,
      offsets: [...def.defaultOffsets],
      channels: [...def.defaultChannels],
      titleOverride: null,
      bodyOverride: null,
      isDefault: true,
      updatedAt: null,
    };
  }
  return {
    key: def.key,
    def,
    enabled: row.enabled,
    // Fixed-timing rules ignore any stored offsets.
    offsets: def.editable ? toOffsets(row.offsets, def.defaultOffsets) : [...def.defaultOffsets],
    channels: row.channels.length ? [...row.channels] : [...def.defaultChannels],
    titleOverride: row.titleTemplate,
    bodyOverride: row.bodyTemplate,
    isDefault: false,
    updatedAt: row.updatedAt,
  };
}
