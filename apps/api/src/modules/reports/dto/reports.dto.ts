import type { ReportFrequency } from '@prisma/client';

// ── Shared ───────────────────────────────────────────────────────────────

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  planId?: string;
  trainerId?: string;
  paymentStatus?: string;
  memberStatus?: string;
  page?: number;
  limit?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Dashboard ────────────────────────────────────────────────────────────

export interface KpiMetricsDto {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  newMembersThisMonth: number;
  expiringMemberships: number;
  todaysAttendance: number;
  monthlyRevenue: string;
  monthlyExpenses: string;
  outstandingPayments: string;
  totalStaff: number;
  activeTrainers: number;
  activeBranches: number;
}

export interface RecentActivityDto {
  type: 'PAYMENT' | 'CHECK_IN' | 'NEW_MEMBER';
  id: string;
  label: string;
  detail: string;
  occurredAt: string;
}

export interface DashboardSummaryDto {
  kpis: KpiMetricsDto;
  recentActivities: RecentActivityDto[];
}

// ── Reports ──────────────────────────────────────────────────────────────

export interface MembershipReportRow {
  memberId: string;
  memberCode: string;
  name: string;
  branch: string;
  plan: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

export interface AttendanceReportRow {
  date: string;
  memberCode: string;
  name: string;
  branch: string;
  checkInTime: string;
  checkOutTime: string | null;
  method: string;
}

export interface RevenueReportRow {
  date: string;
  branch: string;
  method: string;
  amount: string;
}

export interface ExpenseReportRow {
  date: string;
  branch: string;
  category: string;
  amount: string;
  description: string | null;
}

export interface PaymentReportRow {
  paymentNumber: string;
  memberCode: string;
  name: string;
  branch: string;
  finalAmount: string;
  method: string;
  status: string;
  paymentDate: string;
}

export interface StaffReportRow {
  name: string;
  role: string;
  branch: string | null;
  status: string;
  joiningDate: string | null;
}

export interface TrainerPerformanceRow {
  trainerId: string;
  name: string;
  assignedMembers: number;
  activeWorkoutPlans: number;
  activeDietPlans: number;
}

export interface MemberProgressRow {
  memberCode: string;
  name: string;
  workoutPlan: string | null;
  workoutProgressPercent: number | null;
  dietPlan: string | null;
  dietProgressPercent: number | null;
}

export interface BranchPerformanceRow {
  branchId: string;
  branch: string;
  totalMembers: number;
  activeMembers: number;
  monthlyRevenue: string;
  monthlyAttendance: number;
  staffCount: number;
}

export interface ExpiringMembershipRow {
  memberCode: string;
  name: string;
  branch: string;
  plan: string;
  endDate: string;
  daysRemaining: number;
}

export interface ActiveVsInactiveRow {
  status: string;
  count: number;
}

// ── Analytics (trend series) ─────────────────────────────────────────────

export interface TrendPoint {
  date: string;
  value: number;
}

export interface RevenueTrendPoint {
  date: string;
  income: number;
  expenses: number;
}

export interface BranchComparisonRow {
  branchId: string;
  branch: string;
  members: number;
  revenue: number;
  attendance: number;
}

// ── Scheduled reports ────────────────────────────────────────────────────

export const REPORT_TYPES = [
  'membership',
  'attendance',
  'revenue',
  'expenses',
  'payments',
  'staff',
  'trainer-performance',
  'member-progress',
  'branch-performance',
  'expiring-memberships',
  'active-vs-inactive',
  'analytics-revenue-trends',
  'analytics-attendance-trends',
  'analytics-membership-growth',
  'analytics-new-member-growth',
  'analytics-retention',
  'analytics-payment-collection',
  'analytics-branch-comparison',
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface ScheduledReportDto {
  id: string;
  name: string;
  reportType: string;
  frequency: ReportFrequency;
  recipientEmails: string[];
  branch: { id: string; name: string } | null;
  filters: Record<string, unknown> | null;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduledReportInput {
  name: string;
  reportType: ReportType;
  frequency: ReportFrequency;
  recipientEmails: string[];
  branchId?: string;
  filters?: Record<string, unknown>;
  isActive?: boolean;
}

export type UpdateScheduledReportInput = Partial<CreateScheduledReportInput>;
