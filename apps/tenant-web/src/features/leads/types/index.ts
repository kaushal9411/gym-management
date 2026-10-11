export const LEAD_SOURCES = ['WALK_IN', 'PHONE_CALL', 'WEBSITE', 'SOCIAL_MEDIA', 'REFERRAL', 'ADVERTISEMENT', 'OTHER'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'TRIAL_DONE', 'NEGOTIATION', 'CONVERTED', 'LOST'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
/** Statuses a lead can be moved between by hand (CONVERTED only through the convert flow). */
export const OPEN_STATUSES = ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'TRIAL_DONE', 'NEGOTIATION'] as const;

export const LEAD_LOST_REASONS = ['PRICE_TOO_HIGH', 'NOT_INTERESTED', 'JOINED_COMPETITOR', 'LOCATION_TOO_FAR', 'TIMING_NOT_RIGHT', 'NO_RESPONSE', 'OTHER'] as const;
export type LeadLostReason = (typeof LEAD_LOST_REASONS)[number];

export const MANUAL_ACTIVITY_TYPES = ['NOTE', 'CALL', 'WHATSAPP', 'EMAIL', 'VISIT', 'TRIAL', 'FOLLOW_UP'] as const;
export type ManualActivityType = (typeof MANUAL_ACTIVITY_TYPES)[number];
export type LeadActivityType = ManualActivityType | 'STATUS_CHANGE' | 'ASSIGNMENT' | 'CREATED' | 'CONVERTED';

export type FollowUpState = 'overdue' | 'today' | 'upcoming' | 'none';
export type LeadGender = 'MALE' | 'FEMALE' | 'OTHER';

export interface LeadListItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  gender: string | null;
  source: LeadSource;
  sourceDetail: string | null;
  status: LeadStatus;
  branch: { id: string; name: string } | null;
  interestedPlan: { id: string; name: string } | null;
  interest: string | null;
  assignedTo: { id: string; name: string } | null;
  nextFollowUpAt: string | null;
  followUpState: FollowUpState;
  expectedJoinDate: string | null;
  lostReason: LeadLostReason | null;
  lostNote: string | null;
  lostAt: string | null;
  notes: string | null;
  convertedMemberId: string | null;
  convertedAt: string | null;
  lastActivityAt: string;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivity {
  id: string;
  type: LeadActivityType;
  note: string | null;
  outcome: string | null;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus | null;
  scheduledFor: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface LeadDetail extends LeadListItem {
  convertedMember: { id: string; memberId: string; name: string } | null;
  activities: LeadActivity[];
}

export type LeadCounts = Record<'all' | LeadStatus, number>;

export interface LeadSummary {
  total: number;
  open: number;
  converted: number;
  lost: number;
  followUpsOverdue: number;
  followUpsDueToday: number;
}

export interface LeadListResponse {
  items: LeadListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: LeadCounts;
  summary: LeadSummary;
}

export type LeadSortBy = 'createdAt' | 'updatedAt' | 'name' | 'nextFollowUpAt' | 'lastActivityAt' | 'expectedJoinDate';

export interface ListLeadsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: LeadStatus[];
  source?: LeadSource[];
  assignedTo?: string;
  branchId?: string;
  interestedPlanId?: string;
  createdFrom?: string;
  createdTo?: string;
  followUp?: FollowUpState;
  sortBy?: LeadSortBy;
  sortDir?: 'asc' | 'desc';
}

export interface CreateLeadPayload {
  name: string;
  phone: string;
  email?: string;
  source?: LeadSource;
  sourceDetail?: string;
  branchId?: string;
  interestedPlanId?: string;
  interest?: string;
  assignedToUserId?: string;
  nextFollowUpAt?: string;
  expectedJoinDate?: string;
  notes?: string;
}

export interface UpdateLeadPayload {
  name?: string;
  phone?: string;
  email?: string | null;
  source?: LeadSource;
  sourceDetail?: string | null;
  branchId?: string | null;
  interestedPlanId?: string | null;
  interest?: string | null;
  nextFollowUpAt?: string | null;
  expectedJoinDate?: string | null;
  notes?: string | null;
}

export interface ChangeStatusPayload {
  status: LeadStatus;
  lostReason?: LeadLostReason;
  lostNote?: string;
  note?: string;
}

export interface AddActivityPayload {
  type: ManualActivityType;
  note?: string;
  outcome?: string;
  scheduledFor?: string;
  nextFollowUpAt?: string | null;
}

export interface ConvertLeadPayload {
  branchId?: string;
  firstName?: string;
  lastName?: string;
  planId?: string;
  startDate?: string;
  dateOfBirth?: string;
  trainerId?: string;
  notes?: string;
}

export interface ConvertLeadResult {
  lead: LeadDetail;
  member: { id: string; memberId: string; name: string };
}

export interface LeadDuplicate {
  type: 'LEAD' | 'MEMBER';
  id: string;
  name: string;
  status: string | null;
  memberCode: string | null;
  matchedOn: ('phone' | 'email')[];
}

export interface LeadAssignee {
  id: string;
  name: string;
  role: string;
}

export interface FollowUpsResponse {
  items: LeadListItem[];
  counts: { overdue: number; today: number; upcoming: number; due: number };
}

export type AnalyticsRangeKey = 'today' | '7d' | '30d' | 'month' | 'year' | 'custom';

export interface AnalyticsParams {
  range: AnalyticsRangeKey;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}

interface Kpi<P = number> {
  value: number;
  previous: P;
}

export interface HeadlineBucket {
  newLeads: number;
  converted: number;
  previousNewLeads: number;
  previousConverted: number;
  newLeadsDelta: number;
  convertedDelta: number;
}

export interface LeadAnalytics {
  range: { from: string; to: string };
  previousRange: { from: string; to: string };
  kpis: {
    newLeads: Kpi;
    converted: Kpi;
    lost: Kpi;
    open: Kpi<null>;
    conversionRate: Kpi;
    avgDaysToConvert: { value: number | null; previous: number | null };
    followUpsDueToday: Kpi<null>;
    followUpsOverdue: Kpi<null>;
  };
  headline: Record<'today' | 'thisMonth' | 'thisYear', HeadlineBucket>;
  daily: { date: string; newLeads: number; converted: number; lost: number }[];
  monthly: { month: string; newLeads: number; converted: number; conversionRate: number }[];
  funnel: { stages: { stage: string; count: number; pctOfTop: number; dropOff: number; dropOffRate: number }[]; lost: number; total: number };
  bySource: { source: string; leads: number; converted: number; conversionRate: number }[];
  byStaff: { userId: string | null; name: string; leads: number; converted: number; conversionRate: number }[];
  byPlan: { planId: string | null; name: string; leads: number; converted: number; conversionRate: number }[];
  lostReasons: { reason: string; count: number }[];
  ageing: { bucket: string; count: number }[];
  topBranches: { branchId: string; name: string; leads: number; converted: number; conversionRate: number }[];
}
