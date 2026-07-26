export interface KpiMetrics {
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

export interface RecentActivity {
  type: 'PAYMENT' | 'CHECK_IN' | 'NEW_MEMBER';
  id: string;
  label: string;
  detail: string;
  occurredAt: string;
}

export interface DashboardSummary {
  kpis: KpiMetrics;
  recentActivities: RecentActivity[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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

export const TABULAR_REPORT_TYPES = [
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
] as const;
export type TabularReportType = (typeof TABULAR_REPORT_TYPES)[number];

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

export type ScheduledReportFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface ScheduledReport {
  id: string;
  name: string;
  reportType: string;
  frequency: ScheduledReportFrequency;
  recipientEmails: string[];
  branch: { id: string; name: string } | null;
  filters: Record<string, unknown> | null;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduledReportPayload {
  name: string;
  reportType: string;
  frequency: ScheduledReportFrequency;
  recipientEmails: string[];
  branchId?: string;
  isActive?: boolean;
}
