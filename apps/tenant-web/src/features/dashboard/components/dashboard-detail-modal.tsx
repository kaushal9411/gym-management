'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTodayAttendance } from '@/features/attendance/hooks/use-attendance';
import type { AttendanceRecord } from '@/features/attendance/types';
import { useInvoiceList, useIncomeList } from '@/features/finance/hooks/use-finance';
import type { Income, MemberInvoiceListItem, MemberInvoiceStatus } from '@/features/finance/types';
import { useMemberList } from '@/features/members/hooks/use-members';
import type { MemberListItem } from '@/features/members/types';
import { useReportData } from '@/features/reports/hooks/use-reports';
import { useCurrencySymbol } from '@/lib/currency';

export type DashboardStatKind =
  | 'attendance'
  | 'active-members'
  | 'expiring-memberships'
  | 'new-registrations'
  | 'revenue-summary'
  | 'pending-payments';

interface DashboardCardDetailModalProps {
  kind: DashboardStatKind | null;
  branchId?: string;
  onClose: () => void;
}

const TITLES: Record<DashboardStatKind, string> = {
  attendance: "Today's Attendance",
  'active-members': 'Active Members',
  'expiring-memberships': 'Expiring Memberships',
  'new-registrations': 'New Members (this month)',
  'revenue-summary': 'Monthly Revenue',
  'pending-payments': 'Outstanding Payments',
};

function monthStartIso(): string {
  return `${new Date().toISOString().slice(0, 7)}-01`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ViewAllLink({ href }: { href: string }) {
  return (
    <Link href={href} className="block pt-1 text-right text-sm font-medium text-primary hover:underline">
      View all →
    </Link>
  );
}

/** Design frame "Dashboard" — every KPI tile is clickable, opening this modal with the data behind the number (first built on web, verified live, then mirrored on mobile per the user's own two-step request). */
export function DashboardCardDetailModal({ kind, branchId, onClose }: DashboardCardDetailModalProps) {
  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{kind ? TITLES[kind] : ''}</DialogTitle>
        </DialogHeader>
        {kind === 'attendance' ? <TodayAttendanceDetail branchId={branchId} /> : null}
        {kind === 'active-members' ? <ActiveMembersDetail branchId={branchId} /> : null}
        {kind === 'expiring-memberships' ? <ExpiringMembershipsDetail branchId={branchId} /> : null}
        {kind === 'new-registrations' ? <NewMembersDetail branchId={branchId} /> : null}
        {kind === 'revenue-summary' ? <MonthlyRevenueDetail branchId={branchId} /> : null}
        {kind === 'pending-payments' ? <OutstandingPaymentsDetail branchId={branchId} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TodayAttendanceDetail({ branchId }: { branchId?: string }) {
  const attendance = useTodayAttendance(branchId);
  const columns: DataTableColumn<AttendanceRecord>[] = [
    { key: 'member', header: 'Member', render: (a) => `${a.member.name} (${a.member.memberId})` },
    { key: 'checkIn', header: 'Check-in', render: (a) => new Date(a.checkInTime).toLocaleTimeString() },
    { key: 'checkOut', header: 'Check-out', render: (a) => (a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString() : '—') },
    { key: 'status', header: 'Status', render: (a) => <Badge variant={a.status === 'CHECKED_IN' ? 'success' : 'secondary'}>{a.status.replace('_', ' ')}</Badge> },
  ];
  return (
    <div className="space-y-3">
      <DataTable columns={columns} rows={attendance.data ?? []} rowKey={(a) => a.id} loading={attendance.isPending} error={attendance.error} onRetry={() => attendance.refetch()} emptyMessage="No check-ins yet today." />
      <ViewAllLink href="/attendance" />
    </div>
  );
}

function ActiveMembersDetail({ branchId }: { branchId?: string }) {
  const members = useMemberList({ status: 'ACTIVE', branchId, limit: 20, sortBy: 'name', sortDir: 'asc' });
  const columns: DataTableColumn<MemberListItem>[] = [
    { key: 'name', header: 'Name', render: (m) => <Link href={`/members/${m.id}`} className="font-medium hover:underline">{m.name}</Link> },
    { key: 'memberId', header: 'Member ID', render: (m) => m.memberId },
    { key: 'branch', header: 'Branch', render: (m) => m.branch.name },
    { key: 'plan', header: 'Plan', render: (m) => m.currentMembership?.planName ?? '—' },
  ];
  return (
    <div className="space-y-3">
      <DataTable columns={columns} rows={members.data?.items ?? []} rowKey={(m) => m.id} loading={members.isPending} error={members.error} onRetry={() => members.refetch()} emptyMessage="No active members." />
      {members.data && members.data.total > 20 ? <p className="text-xs text-muted-foreground">Showing 20 of {members.data.total}.</p> : null}
      <ViewAllLink href="/members?status=ACTIVE" />
    </div>
  );
}

interface ExpiringMembershipRow {
  memberCode: string;
  name: string;
  branch: string;
  plan: string;
  endDate: string;
  daysRemaining: number;
}

function ExpiringMembershipsDetail({ branchId }: { branchId?: string }) {
  const report = useReportData<ExpiringMembershipRow>('expiring-memberships', { branchId, limit: 20 });
  const rows = Array.isArray(report.data) ? report.data : (report.data?.items ?? []);
  const columns: DataTableColumn<ExpiringMembershipRow>[] = [
    { key: 'name', header: 'Member', render: (r) => `${r.name} (${r.memberCode})` },
    { key: 'plan', header: 'Plan', render: (r) => r.plan },
    { key: 'endDate', header: 'Ends', render: (r) => new Date(r.endDate).toLocaleDateString() },
    { key: 'daysRemaining', header: 'Days left', render: (r) => <Badge variant={r.daysRemaining <= 7 ? 'destructive' : 'warning'}>{r.daysRemaining}</Badge> },
  ];
  return (
    <div className="space-y-3">
      <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.memberCode}-${r.endDate}`} loading={report.isPending} error={report.error} onRetry={() => report.refetch()} emptyMessage="No memberships expiring in the next 30 days." />
      <ViewAllLink href="/reports/expiring-memberships" />
    </div>
  );
}

function NewMembersDetail({ branchId }: { branchId?: string }) {
  const members = useMemberList({ branchId, limit: 50, sortBy: 'createdAt', sortDir: 'desc' });
  const cutoff = monthStartIso();
  const rows = (members.data?.items ?? []).filter((m) => m.createdAt.slice(0, 10) >= cutoff);
  const columns: DataTableColumn<MemberListItem>[] = [
    { key: 'name', header: 'Name', render: (m) => <Link href={`/members/${m.id}`} className="font-medium hover:underline">{m.name}</Link> },
    { key: 'memberId', header: 'Member ID', render: (m) => m.memberId },
    { key: 'branch', header: 'Branch', render: (m) => m.branch.name },
    { key: 'joined', header: 'Joined', render: (m) => new Date(m.createdAt).toLocaleDateString() },
  ];
  return (
    <div className="space-y-3">
      <DataTable columns={columns} rows={rows} rowKey={(m) => m.id} loading={members.isPending} error={members.error} onRetry={() => members.refetch()} emptyMessage="No new members yet this month." />
      <ViewAllLink href="/members" />
    </div>
  );
}

function MonthlyRevenueDetail({ branchId }: { branchId?: string }) {
  const currencySymbol = useCurrencySymbol();
  const income = useIncomeList({ page: 1, limit: 20, branchId, dateFrom: monthStartIso(), dateTo: todayIso(), sortBy: 'incomeDate', sortDir: 'desc' });
  const columns: DataTableColumn<Income>[] = [
    { key: 'date', header: 'Date', render: (i) => new Date(i.incomeDate).toLocaleDateString() },
    { key: 'category', header: 'Category', render: (i) => i.category.replace(/_/g, ' ') },
    { key: 'description', header: 'Description', render: (i) => i.description ?? '—' },
    { key: 'amount', header: 'Amount', render: (i) => `${currencySymbol}${i.amount}` },
  ];
  return (
    <div className="space-y-3">
      <DataTable columns={columns} rows={income.data?.items ?? []} rowKey={(i) => i.id} loading={income.isPending} error={income.error} onRetry={() => income.refetch()} emptyMessage="No income recorded yet this month." />
      {income.data && income.data.total > 20 ? <p className="text-xs text-muted-foreground">Showing 20 of {income.data.total}.</p> : null}
      <ViewAllLink href="/income" />
    </div>
  );
}

const STATUS_TONE: Record<MemberInvoiceStatus, 'destructive' | 'warning' | 'secondary'> = {
  OVERDUE: 'destructive',
  PARTIALLY_PAID: 'warning',
  UNPAID: 'warning',
  PAID: 'secondary',
  CANCELLED: 'secondary',
};

function OutstandingPaymentsDetail({ branchId }: { branchId?: string }) {
  const currencySymbol = useCurrencySymbol();
  // The dashboard KPI sums MemberInvoice rows across all 3 "still owed"
  // statuses at once — the list endpoint only takes one `status` at a time,
  // so this fires 3 small parallel requests and merges them (mirrors the
  // backend's `status: { in: [...] }` dashboard query, see
  // `DashboardService#getKpis`).
  const overdue = useInvoiceList({ page: 1, limit: 10, branchId, status: 'OVERDUE', sortBy: 'dueDate', sortDir: 'asc' });
  const partiallyPaid = useInvoiceList({ page: 1, limit: 10, branchId, status: 'PARTIALLY_PAID', sortBy: 'dueDate', sortDir: 'asc' });
  const unpaid = useInvoiceList({ page: 1, limit: 10, branchId, status: 'UNPAID', sortBy: 'dueDate', sortDir: 'asc' });

  const loading = overdue.isPending || partiallyPaid.isPending || unpaid.isPending;
  const error = overdue.error ?? partiallyPaid.error ?? unpaid.error;
  const rows = [...(overdue.data?.items ?? []), ...(partiallyPaid.data?.items ?? []), ...(unpaid.data?.items ?? [])].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );

  const columns: DataTableColumn<MemberInvoiceListItem>[] = [
    { key: 'invoice', header: 'Invoice', render: (i) => <Link href={`/invoices/${i.id}`} className="font-medium hover:underline">{i.invoiceNumber}</Link> },
    { key: 'member', header: 'Member', render: (i) => i.member.name },
    { key: 'dueDate', header: 'Due', render: (i) => new Date(i.dueDate).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (i) => <Badge variant={STATUS_TONE[i.status]}>{i.status.replace('_', ' ')}</Badge> },
    { key: 'amount', header: 'Amount', render: (i) => `${currencySymbol}${i.totalAmount}` },
  ];
  return (
    <div className="space-y-3">
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(i) => i.id}
        loading={loading}
        error={error}
        onRetry={() => {
          overdue.refetch();
          partiallyPaid.refetch();
          unpaid.refetch();
        }}
        emptyMessage="Nothing outstanding — all invoices are settled."
      />
      <ViewAllLink href="/invoices" />
    </div>
  );
}
