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

// ── Reports redesign: overview + per-report summary (money = decimal strings, counts = numbers) ──

export interface DateRange {
  from: string;
  to: string;
}

export interface MetricPair {
  value: number;
  previous?: number;
}

export interface MoneyPair {
  value: string;
  previous?: string;
}

export interface OverviewKpis {
  revenue: MoneyPair;
  expenses: MoneyPair;
  netProfit: MoneyPair;
  newMembers: MetricPair;
  activeMembers: { value: number };
  checkIns: MetricPair;
  avgDailyCheckIns: MetricPair;
  expiringIn30d: { value: number };
  churned: MetricPair;
}

export interface OverviewDailyPoint {
  date: string;
  revenue: string;
  expenses: string;
  checkIns: number;
  newMembers: number;
  prevRevenue: string;
  prevExpenses: string;
  prevCheckIns: number;
  prevNewMembers: number;
}

export interface ReportsOverview {
  range: DateRange;
  previousRange: DateRange;
  kpis: OverviewKpis;
  daily: OverviewDailyPoint[];
  weekdayAttendance: Array<{ weekday: number | string; count: number; previousCount: number }>;
  hourlyAttendance: Array<{ hour: number; count: number }>;
  memberStatus: Array<{ status: string; count: number }>;
  planDistribution: Array<{ planName: string; activeCount: number; revenue: string }>;
  paymentMethods: Array<{ method: string; amount: string; count: number }>;
  branches: Array<{ branchId: string; name: string; revenue: string; previousRevenue: string; newMembers: number; checkIns: number; activeMembers: number }>;
  topTrainers: Array<{ trainerId: string; name: string; assignedMembers: number }>;
  expiringBuckets: Array<{ label: string; count: number }>;
}

export interface ReportsOverviewParams {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}

export type SummaryValueFormat = 'number' | 'money' | 'percent' | 'text';

export interface ReportSummaryKpi {
  key: string;
  label: string;
  /** Number, decimal string (money) or text depending on `format`. */
  value: number | string;
  format: SummaryValueFormat;
  previous?: number | string;
}

export interface ReportSummaryBreakdown {
  key: string;
  title: string;
  kind: 'donut' | 'bar';
  items: Array<{ label: string; value: number; previous?: number }>;
}

export interface ReportSummary {
  range?: DateRange;
  previousRange?: DateRange;
  kpis: ReportSummaryKpi[];
  breakdowns: ReportSummaryBreakdown[];
  series: { title: string; points: Array<{ date: string; value: number; previous?: number }> } | null;
}
