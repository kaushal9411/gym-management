import type { AutomationKey, CampaignStatus, Channel, RecipientStatus, TemplateKey } from './types';

/** Rules mirrored from the API (`modules/communications/constants/limits.ts`). */
export const TITLE_MAX = 200;
export const BODY_MAX = 2000;
export const NAME_MAX = 120;
export const SMS_TEXT_MAX = 1000;
export const MAX_RECIPIENTS = 5000;
export const LARGE_SEND_THRESHOLD = 100;
export const MAX_SCHEDULE_DAYS = 90;
export const MIN_SCHEDULE_LEAD_MS = 60_000;
export const MAX_FILTER_DAYS_EXPIRING = 90;
export const MAX_NOT_VISITED_DAYS = 365;

export const CAMPAIGN_PLACEHOLDERS = ['firstName', 'lastName', 'memberCode', 'planName', 'endDate', 'amountDue', 'gymName'] as const;

export const PLACEHOLDER_HINT: Record<string, string> = {
  firstName: "Member's first name",
  lastName: "Member's last name",
  memberCode: 'Member ID, e.g. MEM-0001',
  planName: 'Current plan name',
  endDate: 'Membership end date',
  amountDue: 'Open invoice balance in INR',
  gymName: 'Your gym name',
  daysLeft: 'Days left on the membership',
  daysAway: 'Days since the last visit',
  invoiceNumber: 'Invoice number',
  dueDate: 'Invoice due date',
  className: 'Class name',
  classDate: 'Class date',
  classTime: 'Class time',
};

export interface ChannelMeta {
  channel: Channel;
  label: string;
  /** Short glyph shown in the colour dot. */
  glyph: string;
  /** CSS colour (shared token defined in globals.css). */
  color: string;
}

export const CHANNELS: ChannelMeta[] = [
  { channel: 'PUSH', label: 'Push', glyph: 'P', color: 'var(--channel-push)' },
  { channel: 'IN_APP', label: 'In-app', glyph: 'In', color: 'var(--channel-inapp)' },
  { channel: 'EMAIL', label: 'Email', glyph: '@', color: 'var(--channel-email)' },
  { channel: 'SMS', label: 'SMS', glyph: 'S', color: 'var(--channel-sms)' },
  { channel: 'WHATSAPP', label: 'WhatsApp', glyph: 'W', color: 'var(--channel-whatsapp)' },
];

export const CHANNEL_META: Record<Channel, ChannelMeta> = Object.fromEntries(CHANNELS.map((c) => [c.channel, c])) as Record<Channel, ChannelMeta>;

/** Channels the staff member's own contact can receive a test on (the API rejects IN_APP). */
export const TEST_CHANNELS: Channel[] = ['PUSH', 'EMAIL', 'SMS', 'WHATSAPP'];
export const QUIET_CHANNELS: Channel[] = ['SMS', 'WHATSAPP'];

export const DISABLED_REASON_COPY = {
  disabled_platform: 'Not included in your plan',
  disabled_tenant: 'Switched off in your settings',
} as const;

export type TemplateGroup = 'Reminders' | 'Offers' | 'Notices';

/**
 * Starter texts for the template picker. They only use the campaign
 * placeholders, are fully editable, and `templateKey` is a label on the
 * campaign (the text sent is always what is in the editor). Offer texts are
 * deliberately generic: staff add the real discount and dates before sending.
 */
export const TEMPLATES: Array<{ key: TemplateKey; label: string; group?: TemplateGroup; title?: string; body?: string }> = [
  { key: 'CUSTOM', label: 'Custom message' },
  {
    key: 'MEMBERSHIP_EXPIRING',
    label: 'Membership expiring',
    group: 'Reminders',
    title: '{{firstName}}, your {{planName}} plan ends {{endDate}}',
    body: 'Renew at the front desk or in the app to keep your access.',
  },
  {
    key: 'PAYMENT_OVERDUE',
    label: 'Payment overdue',
    group: 'Reminders',
    title: 'Payment due: {{amountDue}}',
    body: 'Hi {{firstName}}, your invoice is overdue. Please pay in the app or at the desk.',
  },
  {
    key: 'CLASS_UPDATE',
    label: 'New class timing',
    group: 'Reminders',
    title: 'New class timing',
    body: 'Evening HIIT now starts at 6:30 pm. Book your spot in the app.',
  },
  {
    key: 'SPECIAL_OFFER',
    label: 'Special offer',
    group: 'Offers',
    title: 'A special offer for you, {{firstName}}',
    body: 'Hi {{firstName}}, {{gymName}} has a special offer for members this week. Ask at the front desk or open the app to claim it before it ends.',
  },
  {
    key: 'WINTER_OFFER',
    label: 'Winter offer',
    group: 'Offers',
    title: 'Winter offer at {{gymName}}',
    body: 'Hi {{firstName}}, beat the winter chill with our winter offer. Stay consistent through the cold months and ask at the front desk for the details. Valid for a limited time.',
  },
  {
    key: 'SUMMER_OFFER',
    label: 'Summer offer',
    group: 'Offers',
    title: 'Summer offer at {{gymName}}',
    body: 'Hi {{firstName}}, get summer-ready with our summer offer. Ask at the front desk or in the app for the details. Valid for a limited time.',
  },
  {
    key: 'FESTIVE_OFFER',
    label: 'Festive offer',
    group: 'Offers',
    title: 'Festive greetings from {{gymName}}',
    body: 'Hi {{firstName}}, celebrate the season with a festive offer on memberships. Visit the front desk to know more. Valid for a limited time.',
  },
  {
    key: 'RENEWAL_OFFER',
    label: 'Early renewal offer',
    group: 'Offers',
    title: 'Renew early, {{firstName}}',
    body: 'Your {{planName}} plan ends on {{endDate}}. Renew before it ends to get a renewal benefit. Ask at the front desk or renew in the app.',
  },
  {
    key: 'REFER_FRIEND',
    label: 'Refer a friend',
    group: 'Offers',
    title: 'Bring a friend to {{gymName}}',
    body: 'Hi {{firstName}}, train better together. Refer a friend and ask at the front desk about our referral reward.',
  },
  {
    key: 'COMEBACK_OFFER',
    label: 'We miss you',
    group: 'Offers',
    title: 'We miss you, {{firstName}}',
    body: 'It has been a while since your last visit. Come back this week and we will help you restart your routine. Your {{planName}} plan is active until {{endDate}}.',
  },
  {
    key: 'HOLIDAY_NOTICE',
    label: 'Holiday notice',
    group: 'Notices',
    title: 'Holiday notice from {{gymName}}',
    body: 'Hi {{firstName}}, {{gymName}} will be closed on the upcoming holiday and will reopen on the next working day. Plan your workout accordingly.',
  },
  {
    key: 'TIMING_CHANGE',
    label: 'Gym timing change',
    group: 'Notices',
    title: 'Gym timing change',
    body: 'Hi {{firstName}}, our gym timings are changing. Please check the app for the new opening hours.',
  },
  {
    key: 'FEEDBACK_REQUEST',
    label: 'Feedback request',
    group: 'Notices',
    title: 'How are we doing, {{firstName}}?',
    body: 'Tell us what you like and what we can improve at {{gymName}}. Share your feedback with the front desk or your trainer.',
  },
];

export const TEMPLATE_GROUPS: TemplateGroup[] = ['Offers', 'Reminders', 'Notices'];

export const CAMPAIGN_STATUS_META: Record<CampaignStatus, { label: string; tone: 'success' | 'warning' | 'destructive' | 'info' | 'muted' }> = {
  DRAFT: { label: 'Draft', tone: 'muted' },
  SCHEDULED: { label: 'Scheduled', tone: 'info' },
  SENDING: { label: 'Sending', tone: 'info' },
  SENT: { label: 'Sent', tone: 'success' },
  PARTIAL: { label: 'Partly sent', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'destructive' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
};

export const RECIPIENT_STATUS_META: Record<RecipientStatus, { label: string; tone: 'success' | 'warning' | 'destructive' | 'info' | 'muted' }> = {
  QUEUED: { label: 'Waiting', tone: 'info' },
  SENT: { label: 'Sent', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'destructive' },
  SKIPPED_OPTED_OUT: { label: 'Opted out', tone: 'warning' },
  SKIPPED_NO_CONTACT: { label: 'No contact', tone: 'warning' },
  SKIPPED_QUOTA: { label: 'Over limit', tone: 'warning' },
  SKIPPED_DISABLED: { label: 'Channel off', tone: 'warning' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
};

/** Cancellable / editable lifecycle sets (API: PATCH only DRAFT|SCHEDULED, cancel DRAFT|SCHEDULED|SENDING). */
export const EDITABLE_STATUSES: CampaignStatus[] = ['DRAFT', 'SCHEDULED'];
export const CANCELLABLE_STATUSES: CampaignStatus[] = ['DRAFT', 'SCHEDULED', 'SENDING'];
export const RETRYABLE_STATUSES: CampaignStatus[] = ['SENT', 'PARTIAL', 'FAILED'];

export const AUTOMATION_TIMING_COPY: Record<string, { unit: string; suffix: string }> = {
  DAYS_BEFORE: { unit: 'day', suffix: 'before' },
  DAYS_AFTER: { unit: 'day', suffix: 'after' },
  HOURS_BEFORE: { unit: 'hour', suffix: 'before' },
  DAYS_SINCE_VISIT: { unit: 'day', suffix: 'since the last visit' },
};

export const AUTOMATION_ANCHOR: Partial<Record<AutomationKey, string>> = {
  MEMBERSHIP_EXPIRING: 'the end date',
  MEMBERSHIP_EXPIRED: 'the end date',
  PAYMENT_OVERDUE: 'the due date',
  INVOICE_DUE_SOON: 'the due date',
  PAYMENT_FAILED: 'the failed payment',
  CLASS_REMINDER: 'a booked class',
};

export const COMMUNICATIONS_ROUTES = {
  send: '/communications/send',
  automations: '/communications/automations',
  history: '/communications/history',
} as const;

/** Permission keys the feature gates on (existing keys, plus `notifications:send` added by the backend). */
export const COMMUNICATIONS_PERMISSIONS = {
  view: 'notifications:view',
  send: 'notifications:send',
  manage: 'notifications:manage',
} as const;
