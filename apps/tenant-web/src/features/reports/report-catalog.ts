import { Activity, GitCompareArrows, Repeat2, TrendingUp, UserPlus, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { REPORT_CARDS } from './components/report-cards';
import type { ReportAccent } from './lib/reports-theme';
import type { TabularReportType } from './types';

export type ReportCategory = 'members' | 'finance' | 'attendance' | 'staff-operations' | 'analytics';

export const REPORT_CATEGORIES: Array<{ id: ReportCategory; label: string; description: string; accent: ReportAccent }> = [
  { id: 'members', label: 'Members', description: 'Memberships, status and progress', accent: 'members' },
  { id: 'finance', label: 'Finance', description: 'Revenue, expenses and payments', accent: 'finance' },
  { id: 'attendance', label: 'Attendance', description: 'Check-ins and footfall', accent: 'attendance' },
  { id: 'staff-operations', label: 'Staff & Operations', description: 'Team, trainers and branches', accent: 'staff' },
  { id: 'analytics', label: 'Analytics', description: 'Trends and comparisons over time', accent: 'analytics' },
];

export interface ReportCatalogEntry {
  /** Report type (`membership`) or analytics id (`analytics-revenue-trends`, same values as `REPORT_TYPE_OPTIONS`). */
  id: string;
  kind: 'report' | 'analytics';
  route: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: ReportCategory;
  accent: ReportAccent;
  permission: 'reports:view' | 'analytics:view';
  /** Whether the date-range filter applies (mirrors the viewer's `showDateRange`). */
  showsDateRange: boolean;
  /** Suggested default sort column key for the tabular viewer. */
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
}

interface ReportMeta {
  category: ReportCategory;
  accent: ReportAccent;
  showsDateRange: boolean;
  defaultSort?: ReportCatalogEntry['defaultSort'];
}

const REPORT_META: Record<TabularReportType, ReportMeta> = {
  membership: { category: 'members', accent: 'members', showsDateRange: false, defaultSort: { key: 'endDate', dir: 'asc' } },
  'member-progress': { category: 'members', accent: 'members', showsDateRange: false, defaultSort: { key: 'workoutProgressPercent', dir: 'desc' } },
  'expiring-memberships': { category: 'members', accent: 'members', showsDateRange: false, defaultSort: { key: 'endDate', dir: 'asc' } },
  'active-vs-inactive': { category: 'members', accent: 'members', showsDateRange: false },
  revenue: { category: 'finance', accent: 'finance', showsDateRange: true, defaultSort: { key: 'date', dir: 'desc' } },
  expenses: { category: 'finance', accent: 'finance', showsDateRange: true, defaultSort: { key: 'date', dir: 'desc' } },
  payments: { category: 'finance', accent: 'finance', showsDateRange: true, defaultSort: { key: 'paymentDate', dir: 'desc' } },
  attendance: { category: 'attendance', accent: 'attendance', showsDateRange: true, defaultSort: { key: 'date', dir: 'desc' } },
  staff: { category: 'staff-operations', accent: 'staff', showsDateRange: false },
  'trainer-performance': { category: 'staff-operations', accent: 'staff', showsDateRange: false, defaultSort: { key: 'assignedMembers', dir: 'desc' } },
  'branch-performance': { category: 'staff-operations', accent: 'operations', showsDateRange: false, defaultSort: { key: 'monthlyRevenue', dir: 'desc' } },
};

const REPORT_ENTRIES: ReportCatalogEntry[] = REPORT_CARDS.map((c) => ({
  id: c.reportType,
  kind: 'report',
  route: `/reports/${c.reportType}`,
  title: c.label,
  description: c.description,
  icon: c.icon,
  permission: 'reports:view',
  ...REPORT_META[c.reportType],
}));

const analytics = (slug: string, title: string, description: string, icon: LucideIcon, accent: ReportAccent): ReportCatalogEntry => ({
  id: `analytics-${slug}`,
  kind: 'analytics',
  route: `/analytics?view=${slug}`,
  title,
  description,
  icon,
  category: 'analytics',
  accent,
  permission: 'analytics:view',
  showsDateRange: true,
});

const ANALYTICS_ENTRIES: ReportCatalogEntry[] = [
  analytics('revenue-trends', 'Revenue Trends', 'Income vs expenses over time.', TrendingUp, 'finance'),
  analytics('attendance-trends', 'Attendance Trends', 'Daily check-in volume.', Activity, 'attendance'),
  analytics('membership-growth', 'Membership Growth', 'Active membership count over time.', Users, 'members'),
  analytics('new-member-growth', 'New Member Growth', 'Sign-ups per day.', UserPlus, 'members'),
  analytics('retention', 'Member Retention', 'How many members stay.', Repeat2, 'analytics'),
  analytics('payment-collection', 'Payment Collection', 'Collected vs refunded over time.', Wallet, 'finance'),
  analytics('branch-comparison', 'Branch Comparison', 'Members, revenue and attendance by branch.', GitCompareArrows, 'operations'),
];

/** All 11 report types + 7 analytics views. */
export const REPORT_CATALOG: ReportCatalogEntry[] = [...REPORT_ENTRIES, ...ANALYTICS_ENTRIES];

export const getCatalogEntry = (id: string): ReportCatalogEntry | undefined => REPORT_CATALOG.find((e) => e.id === id);

/** Entries grouped per category in display order (empty categories omitted). */
export function groupCatalog(entries: ReportCatalogEntry[] = REPORT_CATALOG): Array<{ category: (typeof REPORT_CATEGORIES)[number]; entries: ReportCatalogEntry[] }> {
  return REPORT_CATEGORIES.map((category) => ({ category, entries: entries.filter((e) => e.category === category.id) })).filter((g) => g.entries.length > 0);
}

export const categoryOf = (id: ReportCategory) => REPORT_CATEGORIES.find((c) => c.id === id)!;
