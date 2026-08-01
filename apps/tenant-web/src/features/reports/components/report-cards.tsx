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

/** Icon-badge accent for a report card — same 6-hue vocabulary as `StatTone` (`statistic-card.tsx`), rotated across the grid so it reads as varied rather than a wall of one flat color. */
export type ReportCardTone = 'primary' | 'orange' | 'aqua' | 'violet' | 'success' | 'warning';

/** CVD-validated token per tone — theme-aware via `color-mix(in oklch, VAR X%, transparent)` at the call site. */
export const REPORT_CARD_TONE_VAR: Record<ReportCardTone, string> = {
  primary: 'var(--primary)',
  orange: 'var(--chart-2)',
  aqua: 'var(--chart-3)',
  violet: 'var(--chart-7)',
  success: 'var(--success)',
  warning: 'var(--warning)',
};

export interface ReportCardConfig {
  reportType: TabularReportType;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: ReportCardTone;
}

export const REPORT_CARDS: ReportCardConfig[] = [
  { reportType: 'membership', label: 'Membership Report', description: 'Members with plan, status, and dates.', icon: ClipboardList, tone: 'primary' },
  { reportType: 'attendance', label: 'Attendance Report', description: 'Check-ins and check-outs over time.', icon: UserCheck, tone: 'orange' },
  { reportType: 'revenue', label: 'Revenue Report', description: 'Successful payments over time.', icon: TrendingUp, tone: 'aqua' },
  { reportType: 'expenses', label: 'Expense Report', description: 'Recorded expenses over time.', icon: Wallet, tone: 'violet' },
  { reportType: 'payments', label: 'Payment Report', description: 'Every payment, with status.', icon: CreditCard, tone: 'success' },
  { reportType: 'staff', label: 'Staff Report', description: 'Managers, trainers, and receptionists.', icon: Users, tone: 'warning' },
  { reportType: 'trainer-performance', label: 'Trainer Performance', description: 'Assigned members and active plans.', icon: Activity, tone: 'primary' },
  { reportType: 'member-progress', label: 'Member Progress', description: 'Workout and diet adherence.', icon: BarChart3, tone: 'orange' },
  { reportType: 'branch-performance', label: 'Branch Performance', description: 'Members, revenue, and attendance per branch.', icon: Building2, tone: 'aqua' },
  { reportType: 'expiring-memberships', label: 'Expiring Memberships', description: 'Memberships ending within 30 days.', icon: CalendarClock, tone: 'violet' },
  { reportType: 'active-vs-inactive', label: 'Active vs Inactive', description: 'Member count by status.', icon: Receipt, tone: 'success' },
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
