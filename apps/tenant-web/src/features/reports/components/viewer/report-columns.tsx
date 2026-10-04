import * as React from 'react';

import { PAYMENT_STATUS_META, METHOD_LABELS, tokenPillStyle } from '@/features/finance/components/finance-badges';
import type { MemberPaymentMethod, MemberPaymentStatus } from '@/features/finance/types';
import { cn } from '@/lib/utils';
import { formatMoney, num, shortDate } from '../../lib/format';
import type { TabularReportType } from '../../types';

export type CellKind = 'text' | 'strong' | 'code' | 'money' | 'date' | 'time' | 'status' | 'method' | 'days' | 'percent' | 'count';

export interface ReportColumn {
  key: string;
  label: string;
  kind: CellKind;
}

const c = (key: string, label: string, kind: CellKind = 'text'): ReportColumn => ({ key, label, kind });

/** Column layout per tabular report (keys mirror the API rows). */
export const REPORT_COLUMNS: Record<TabularReportType, ReportColumn[]> = {
  membership: [c('memberCode', 'Member ID', 'code'), c('name', 'Name', 'strong'), c('branch', 'Branch'), c('plan', 'Plan'), c('status', 'Status', 'status'), c('startDate', 'Start date', 'date'), c('endDate', 'End date', 'date')],
  attendance: [c('date', 'Date', 'date'), c('memberCode', 'Member ID', 'code'), c('name', 'Name', 'strong'), c('branch', 'Branch'), c('checkInTime', 'Check in', 'time'), c('checkOutTime', 'Check out', 'time'), c('method', 'Method', 'method')],
  revenue: [c('date', 'Date', 'date'), c('branch', 'Branch'), c('method', 'Method', 'method'), c('amount', 'Amount', 'money')],
  expenses: [c('date', 'Date', 'date'), c('branch', 'Branch'), c('category', 'Category', 'method'), c('amount', 'Amount', 'money'), c('description', 'Description')],
  payments: [c('paymentNumber', 'Payment #', 'code'), c('memberCode', 'Member ID', 'code'), c('name', 'Name', 'strong'), c('branch', 'Branch'), c('finalAmount', 'Amount', 'money'), c('method', 'Method', 'method'), c('status', 'Status', 'status'), c('paymentDate', 'Date', 'date')],
  staff: [c('name', 'Name', 'strong'), c('role', 'Role', 'method'), c('branch', 'Branch'), c('status', 'Status', 'status'), c('joiningDate', 'Joined', 'date')],
  'trainer-performance': [c('name', 'Trainer', 'strong'), c('assignedMembers', 'Assigned members', 'count'), c('activeWorkoutPlans', 'Active workout plans', 'count'), c('activeDietPlans', 'Active diet plans', 'count')],
  'member-progress': [c('memberCode', 'Member ID', 'code'), c('name', 'Name', 'strong'), c('workoutPlan', 'Workout plan'), c('workoutProgressPercent', 'Workout %', 'percent'), c('dietPlan', 'Diet plan'), c('dietProgressPercent', 'Diet %', 'percent')],
  'branch-performance': [c('branch', 'Branch', 'strong'), c('totalMembers', 'Total members', 'count'), c('activeMembers', 'Active members', 'count'), c('monthlyRevenue', 'Monthly revenue', 'money'), c('monthlyAttendance', 'Monthly attendance', 'count'), c('staffCount', 'Staff', 'count')],
  'expiring-memberships': [c('memberCode', 'Member ID', 'code'), c('name', 'Name', 'strong'), c('branch', 'Branch'), c('plan', 'Plan'), c('endDate', 'End date', 'date'), c('daysRemaining', 'Days remaining', 'days')],
  'active-vs-inactive': [c('status', 'Status', 'status'), c('count', 'Count', 'count')],
};

/** Field(s) that identify a row; combined with the in-page index to form a cheap, stable React key. */
const ROW_ID_FIELDS: Partial<Record<TabularReportType, string[]>> = {
  membership: ['memberCode'],
  attendance: ['memberCode', 'checkInTime'],
  payments: ['paymentNumber'],
  staff: ['name', 'role'],
  'trainer-performance': ['name'],
  'member-progress': ['memberCode'],
  'branch-performance': ['branch'],
  'expiring-memberships': ['memberCode'],
  'active-vs-inactive': ['status'],
};

export function rowKeyFor(type: TabularReportType, row: Record<string, unknown>, index: number): string {
  const fields = ROW_ID_FIELDS[type] ?? ['date', 'branch', 'amount'];
  return `${fields.map((f) => String(row[f] ?? '')).join('|')}#${index}`;
}

const titleCase = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/^\w|\s\w/g, (m) => m.toUpperCase());

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'var(--success)',
  INACTIVE: 'var(--muted-foreground)',
  FROZEN: 'var(--chart-2)',
  EXPIRED: 'var(--destructive)',
  SUSPENDED: 'var(--destructive)',
  PENDING: 'var(--chart-4)',
  INVITED: 'var(--chart-4)',
};

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold" style={tokenPillStyle(color)}>
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}

const empty = <span className="text-muted-foreground/60">—</span>;

/** Renders one formatted cell; `symbol` is the tenant currency symbol. */
export function renderCell(col: ReportColumn, raw: unknown, symbol: string): React.ReactNode {
  if (raw === null || raw === undefined || raw === '' || raw === '—') return empty;
  const text = String(raw);
  switch (col.kind) {
    case 'money':
      return <span className="font-bold tabular-nums">{formatMoney(symbol, num(text))}</span>;
    case 'count':
      return <span className="font-semibold tabular-nums">{num(text).toLocaleString()}</span>;
    case 'date':
      return <span className="whitespace-nowrap tabular-nums">{shortDate(text, { day: 'numeric', month: 'short', year: 'numeric' })}</span>;
    case 'time':
      return <span className="whitespace-nowrap tabular-nums">{new Date(text).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>;
    case 'code':
      return <span className="font-mono text-xs font-semibold tabular-nums text-primary">{text}</span>;
    case 'strong':
      return <span className="font-bold">{text}</span>;
    case 'status': {
      const pay = PAYMENT_STATUS_META[text as MemberPaymentStatus];
      if (pay) return <Pill label={pay.label} color={pay.color} />;
      return <Pill label={titleCase(text)} color={STATUS_COLORS[text.toUpperCase()] ?? 'var(--chart-1)'} />;
    }
    case 'method': {
      const label = METHOD_LABELS[text as MemberPaymentMethod] ?? titleCase(text);
      return <span className="font-medium">{label}</span>;
    }
    case 'days': {
      const d = num(text);
      const color = d <= 7 ? 'var(--destructive)' : d <= 14 ? 'var(--warning)' : 'var(--success)';
      return <Pill label={`${d} day${d === 1 ? '' : 's'}`} color={color} />;
    }
    case 'percent': {
      if (Number.isNaN(Number(text))) return empty;
      const p = Math.max(0, Math.min(100, Number(text)));
      const color = p >= 70 ? 'var(--success)' : p >= 35 ? 'var(--chart-4)' : 'var(--destructive)';
      return (
        <span className="flex min-w-[120px] items-center gap-2">
          <span className="relative h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--muted-foreground) 16%, transparent)' }}>
            <span className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-700')} style={{ width: `${p}%`, backgroundColor: color }} />
          </span>
          <span className="w-9 text-right text-xs font-bold tabular-nums">{Math.round(p)}%</span>
        </span>
      );
    }
    default:
      return <span className="text-foreground/90">{text}</span>;
  }
}

export const isNumericKind = (k: CellKind) => k === 'money' || k === 'count';
