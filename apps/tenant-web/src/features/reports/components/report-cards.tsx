import {
  Activity,
  BarChart3,
  Building2,
  CalendarClock,
  ClipboardList,
  CreditCard,
  Receipt,
  TrendingUp,
  Users,
  UserCheck,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { TabularReportType } from '../types';

export interface ReportCardConfig {
  reportType: TabularReportType;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const REPORT_CARDS: ReportCardConfig[] = [
  { reportType: 'membership', label: 'Membership Report', description: 'Members with plan, status, and dates.', icon: ClipboardList },
  { reportType: 'attendance', label: 'Attendance Report', description: 'Check-ins and check-outs over time.', icon: UserCheck },
  { reportType: 'revenue', label: 'Revenue Report', description: 'Successful payments over time.', icon: TrendingUp },
  { reportType: 'expenses', label: 'Expense Report', description: 'Recorded expenses over time.', icon: Wallet },
  { reportType: 'payments', label: 'Payment Report', description: 'Every payment, with status.', icon: CreditCard },
  { reportType: 'staff', label: 'Staff Report', description: 'Managers, trainers, and receptionists.', icon: Users },
  { reportType: 'trainer-performance', label: 'Trainer Performance', description: 'Assigned members and active plans.', icon: Activity },
  { reportType: 'member-progress', label: 'Member Progress', description: 'Workout and diet adherence.', icon: BarChart3 },
  { reportType: 'branch-performance', label: 'Branch Performance', description: 'Members, revenue, and attendance per branch.', icon: Building2 },
  { reportType: 'expiring-memberships', label: 'Expiring Memberships', description: 'Memberships ending within 30 days.', icon: CalendarClock },
  { reportType: 'active-vs-inactive', label: 'Active vs Inactive', description: 'Member count by status.', icon: Receipt },
];

/** All 18 report/analytics types — backs the Scheduled Reports "which report" picker. */
export const REPORT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  ...REPORT_CARDS.map((c) => ({ value: c.reportType, label: c.label })),
  { value: 'analytics-revenue-trends', label: 'Analytics: Revenue Trends' },
  { value: 'analytics-attendance-trends', label: 'Analytics: Attendance Trends' },
  { value: 'analytics-membership-growth', label: 'Analytics: Membership Growth' },
  { value: 'analytics-new-member-growth', label: 'Analytics: New Member Growth' },
  { value: 'analytics-retention', label: 'Analytics: Member Retention' },
  { value: 'analytics-payment-collection', label: 'Analytics: Payment Collection' },
  { value: 'analytics-branch-comparison', label: 'Analytics: Branch Comparison' },
];
