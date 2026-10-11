import type { FollowUpBucket } from '../utils/lead-rules.util';

export interface LeadListItemDto {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  gender: string | null;
  source: string;
  sourceDetail: string | null;
  status: string;
  branch: { id: string; name: string } | null;
  interestedPlan: { id: string; name: string } | null;
  interest: string | null;
  assignedTo: { id: string; name: string } | null;
  nextFollowUpAt: string | null;
  followUpState: FollowUpBucket;
  expectedJoinDate: string | null;
  lostReason: string | null;
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

export interface LeadActivityDto {
  id: string;
  type: string;
  note: string | null;
  outcome: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  scheduledFor: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}

export interface LeadDetailDto extends LeadListItemDto {
  convertedMember: { id: string; memberId: string; name: string } | null;
  activities: LeadActivityDto[];
}

export interface LeadDuplicateMatch {
  type: 'LEAD' | 'MEMBER';
  id: string;
  name: string;
  /** Lead status, or null for a member. */
  status: string | null;
  /** Member code (e.g. MEM-0007), null for a lead. */
  memberCode: string | null;
  matchedOn: Array<'phone' | 'email'>;
}

export interface LeadAnalyticsDto {
  range: { from: string; to: string };
  previousRange: { from: string; to: string };
  kpis: {
    newLeads: { value: number; previous: number };
    converted: { value: number; previous: number };
    lost: { value: number; previous: number };
    open: { value: number; previous: null };
    conversionRate: { value: number; previous: number };
    avgDaysToConvert: { value: number | null; previous: number | null };
    followUpsDueToday: { value: number; previous: null };
    followUpsOverdue: { value: number; previous: null };
  };
  headline: Record<'today' | 'thisMonth' | 'thisYear', { newLeads: number; converted: number; previousNewLeads: number; previousConverted: number; newLeadsDelta: number; convertedDelta: number }>;
  daily: Array<{ date: string; newLeads: number; converted: number; lost: number }>;
  monthly: Array<{ month: string; newLeads: number; converted: number; conversionRate: number }>;
  funnel: {
    stages: Array<{ stage: string; count: number; pctOfTop: number; dropOff: number; dropOffRate: number }>;
    lost: number;
    total: number;
  };
  bySource: Array<{ source: string; leads: number; converted: number; conversionRate: number }>;
  byStaff: Array<{ userId: string | null; name: string; leads: number; converted: number; conversionRate: number }>;
  byPlan: Array<{ planId: string | null; name: string; leads: number; converted: number; conversionRate: number }>;
  lostReasons: Array<{ reason: string; count: number }>;
  ageing: Array<{ bucket: string; count: number }>;
  topBranches: Array<{ branchId: string; name: string; leads: number; converted: number; conversionRate: number }>;
}
