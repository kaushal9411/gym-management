/** Mirrors `docs/COMMUNICATIONS-API.md` (the backend contract). */

export type Channel = 'PUSH' | 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';
export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'PARTIAL' | 'FAILED' | 'CANCELLED';
export type AudienceMode = 'FILTERS' | 'PICKED';
export type RecipientStatus = 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED_OPTED_OUT' | 'SKIPPED_NO_CONTACT' | 'SKIPPED_QUOTA' | 'SKIPPED_DISABLED' | 'CANCELLED';
export type SendMode = 'NOW' | 'SCHEDULE' | 'DRAFT';
export type TemplateKey =
  | 'CUSTOM'
  | 'MEMBERSHIP_EXPIRING'
  | 'PAYMENT_OVERDUE'
  | 'CLASS_UPDATE'
  | 'SPECIAL_OFFER'
  | 'WINTER_OFFER'
  | 'SUMMER_OFFER'
  | 'FESTIVE_OFFER'
  | 'RENEWAL_OFFER'
  | 'REFER_FRIEND'
  | 'COMEBACK_OFFER'
  | 'HOLIDAY_NOTICE'
  | 'TIMING_CHANGE'
  | 'FEEDBACK_REQUEST';
export type AutomationKey =
  | 'MEMBERSHIP_EXPIRING'
  | 'MEMBERSHIP_EXPIRED'
  | 'PAYMENT_OVERDUE'
  | 'INVOICE_DUE_SOON'
  | 'PAYMENT_FAILED'
  | 'CLASS_REMINDER'
  | 'CLASS_SCHEDULED_OR_CHANGED'
  | 'BIRTHDAY'
  | 'WE_MISS_YOU';
export type DisabledReason = 'disabled_platform' | 'disabled_tenant' | null;
export type MembershipStatusFilter = 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'FROZEN' | 'NO_PLAN';

export interface AudienceFilter {
  membershipStatus?: MembershipStatusFilter;
  expiringWithinDays?: number;
  planIds?: string[];
  branchIds?: string[];
  trainerIds?: string[];
  hasTrainer?: boolean;
  hasOverdueInvoice?: boolean;
  hasUnpaidInvoice?: boolean;
  notVisitedDays?: number;
  birthdayThisWeek?: boolean;
  bookedClassSessionId?: string;
}

// ── Overview ────────────────────────────────────────────────────────────
export interface ChannelQuotaOverview {
  channel: Channel;
  enabled: boolean;
  disabledReason: DisabledReason;
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface QuietHoursInfo {
  start: string;
  end: string;
  channels: Channel[];
  timezoneBasis?: string;
}

export interface CommunicationsOverview {
  periodKey: string;
  channels: ChannelQuotaOverview[];
  recent: Campaign[];
  automations: { total: number; enabled: number };
  quietHours: QuietHoursInfo;
}

// ── Audience ────────────────────────────────────────────────────────────
export interface PreviewRequest {
  audienceMode: AudienceMode;
  audienceFilter?: AudienceFilter;
  pickedMemberIds?: string[];
  channels?: Channel[];
  title?: string;
  body?: string;
}

export interface ChannelPreviewQuota {
  enabled: boolean;
  disabledReason: DisabledReason;
  limit: number | null;
  used: number;
  remaining: number | null;
  wouldUse: number;
  over: boolean;
  shortBy: number;
}

export interface ChannelPreview {
  channel: Channel;
  contactable: number;
  optedOut: number;
  willReceive: number;
  quota: ChannelPreviewQuota;
}

export interface AudiencePreview {
  total: number;
  sample: Array<{ id: string; memberId: string; name: string }>;
  maxRecipients: number;
  exceedsMax: boolean;
  largeSend: boolean;
  largeSendThreshold: number;
  channels: ChannelPreview[];
  overLimit: Channel[];
  sms?: { characters: number; segments: number; encoding: string };
}

export interface AudienceMember {
  id: string;
  memberId: string;
  name: string;
  planName: string | null;
  branchId: string;
  branchName: string;
  membershipStatus: 'ACTIVE' | 'EXPIRED' | 'FROZEN' | 'NO_PLAN' | 'PENDING';
  hasEmail: boolean;
  hasPhone: boolean;
  hasDevice: boolean;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AudienceMemberParams {
  search?: string;
  branchId?: string;
  page?: number;
  limit?: number;
}

// ── Campaigns ───────────────────────────────────────────────────────────
export interface Campaign {
  id: string;
  name: string;
  title: string;
  body: string;
  channels: Channel[];
  audienceMode: AudienceMode;
  audienceFilter: AudienceFilter;
  pickedCount: number;
  templateKey: TemplateKey | null;
  status: CampaignStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  holdQuietHours: boolean;
  recipientCount: number;
  messageCount: number;
  queuedCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  cancelledCount: number;
  failureReason: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  notices?: string[];
  idempotentReplay?: boolean;
}

export interface CampaignDetail extends Campaign {
  breakdown: Array<{ channel: Channel; total: number; queued: number; sent: number; failed: number; skipped: number; cancelled: number }>;
  skippedByReason: Partial<Record<'SKIPPED_OPTED_OUT' | 'SKIPPED_NO_CONTACT' | 'SKIPPED_QUOTA' | 'SKIPPED_DISABLED', number>>;
  heldCount: number;
  nextReleaseAt: string | null;
  pickedMemberIds?: string[];
}

export interface CampaignListParams {
  status?: CampaignStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CampaignCounts {
  all: number;
  draft: number;
  scheduled: number;
  sending: number;
  sent: number;
  partial: number;
  failed: number;
  cancelled: number;
}

export interface CampaignListResult extends Paginated<Campaign> {
  counts: CampaignCounts;
}

export interface CampaignRecipient {
  id: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  channel: Channel;
  status: RecipientStatus;
  error: string | null;
  sentAt: string | null;
  heldUntil: string | null;
}

export interface RecipientListParams {
  status?: RecipientStatus;
  channel?: Channel;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CampaignInput {
  name?: string;
  title: string;
  body: string;
  channels: Channel[];
  audienceMode: AudienceMode;
  audienceFilter?: AudienceFilter;
  pickedMemberIds?: string[];
  templateKey?: TemplateKey;
  sendMode: SendMode;
  scheduledAt?: string;
  holdQuietHours: boolean;
  confirmLargeSend?: boolean;
}

export type CampaignPatch = Partial<Omit<CampaignInput, 'sendMode'>>;

export interface TestSendInput {
  title: string;
  body: string;
  channels: Exclude<Channel, 'IN_APP'>[];
}

export interface TestSendResult {
  results: Array<{ channel: Channel; status: 'QUEUED' | 'SKIPPED' | 'FAILED'; message: string }>;
}

// ── Automations ─────────────────────────────────────────────────────────
export type TimingUnit = 'DAYS_BEFORE' | 'DAYS_AFTER' | 'HOURS_BEFORE' | 'DAYS_SINCE_VISIT' | 'ON_DAY' | 'EVENT';

export interface AutomationRule {
  key: AutomationKey;
  label: string;
  description: string;
  kind: 'TRANSACTIONAL' | 'PROMOTIONAL';
  timing: { unit: TimingUnit; editable: boolean; min: number; max: number; maxCount: number; defaultOffsets: number[] };
  enabled: boolean;
  isDefault: boolean;
  offsets: number[];
  channels: Channel[];
  allowedChannels: Channel[];
  unavailableChannels: Array<{ channel: Channel; reason: Exclude<DisabledReason, null> }>;
  title: string | null;
  body: string | null;
  defaultTitle: string;
  defaultBody: string;
  allowedPlaceholders: string[];
  sentLast7Days: number;
  lastSentAt: string | null;
  updatedAt: string | null;
}

export interface AutomationsResult {
  quietHours: { start: string; end: string; channels: Channel[] };
  items: AutomationRule[];
}

export interface AutomationInput {
  enabled: boolean;
  offsets?: number[];
  channels: Channel[];
  title?: string | null;
  body?: string | null;
}

// ── Member plane ────────────────────────────────────────────────────────
export interface MemberNotificationPreferences {
  channels: Array<{ channel: 'PUSH' | 'EMAIL' | 'SMS' | 'WHATSAPP'; label: string; promotionalOptOut: boolean }>;
  nonBlockable: Array<{ key: string; label: string }>;
  note: string;
}
