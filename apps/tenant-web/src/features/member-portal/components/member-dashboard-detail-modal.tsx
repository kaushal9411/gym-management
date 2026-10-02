'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { MEMBER_PORTAL_ROUTES } from '../constants';
import type { MemberPortalAttendanceItem, MemberPortalInvoice, MemberPortalProfile, MemberPortalWorkout } from '../services/member-portal.service';
import { PayInvoiceButton } from './pay-invoice-button';

export type MemberDashboardStatKind = 'membership' | 'attendance' | 'workout' | 'outstanding';

interface MemberDashboardDetailModalProps {
  kind: MemberDashboardStatKind | null;
  onClose: () => void;
  membership: MemberPortalProfile['currentMembership'];
  attendanceItems: MemberPortalAttendanceItem[];
  workout: MemberPortalWorkout | null;
  invoices: MemberPortalInvoice[];
}

const TITLES: Record<MemberDashboardStatKind, string> = {
  membership: 'Membership',
  attendance: 'Your visits',
  workout: 'Workout progress',
  outstanding: 'Outstanding payments',
};

function ViewAllLink({ href }: { href: string }) {
  return (
    <Link href={href} className="block pt-1 text-right text-sm font-medium text-primary hover:underline">
      View all →
    </Link>
  );
}

function daysUntil(dateIso: string): number {
  return Math.ceil((new Date(dateIso).getTime() - Date.now()) / 86_400_000);
}

/** Same "every dashboard tile is clickable, opening a modal with the real records behind the number" pattern as the staff dashboard's `DashboardCardDetailModal` — here every tile's data was already fetched by the dashboard page itself (member-portal's generous default page sizes cover it), so this modal takes it as props instead of re-querying. */
export function MemberDashboardDetailModal({ kind, onClose, membership, attendanceItems, workout, invoices }: MemberDashboardDetailModalProps) {
  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{kind ? TITLES[kind] : ''}</DialogTitle>
        </DialogHeader>
        {kind === 'membership' ? <MembershipDetail membership={membership} /> : null}
        {kind === 'attendance' ? <AttendanceDetail items={attendanceItems} /> : null}
        {kind === 'workout' ? <WorkoutDetail workout={workout} /> : null}
        {kind === 'outstanding' ? <OutstandingDetail invoices={invoices} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function MembershipDetail({ membership }: { membership: MemberPortalProfile['currentMembership'] }) {
  if (!membership) {
    return <EmptyState title="No membership on file" description="Contact the front desk to get a membership plan set up." />;
  }
  const days = daysUntil(membership.endDate);
  const expired = days < 0;
  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Plan</span>
          <span className="font-medium">{membership.planName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Status</span>
          <Badge variant={expired ? 'destructive' : 'success'}>{expired ? 'Expired' : membership.status}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{expired ? 'Expired on' : 'Expires'}</span>
          <span>{new Date(membership.endDate).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{expired ? 'Days overdue' : 'Days left'}</span>
          <span>{Math.abs(days)}</span>
        </div>
      </div>
      {expired ? <ViewAllLink href={MEMBER_PORTAL_ROUTES.renew} /> : null}
    </div>
  );
}

function AttendanceDetail({ items }: { items: MemberPortalAttendanceItem[] }) {
  const columns: DataTableColumn<MemberPortalAttendanceItem>[] = [
    { key: 'date', header: 'Date', render: (a) => new Date(a.attendanceDate).toLocaleDateString() },
    { key: 'branch', header: 'Branch', render: (a) => a.branch.name },
    { key: 'checkIn', header: 'Check-in', render: (a) => new Date(a.checkInTime).toLocaleTimeString() },
    { key: 'checkOut', header: 'Check-out', render: (a) => (a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString() : '—') },
  ];
  return (
    <div className="space-y-3">
      <DataTable columns={columns} rows={items.slice(0, 20)} rowKey={(a) => a.id} emptyMessage="No visits recorded yet." />
      {items.length > 20 ? <p className="text-xs text-muted-foreground">Showing 20 of {items.length}.</p> : null}
      <ViewAllLink href={MEMBER_PORTAL_ROUTES.attendance} />
    </div>
  );
}

function WorkoutDetail({ workout }: { workout: MemberPortalWorkout | null }) {
  if (!workout) {
    return <EmptyState title="No workout plan assigned" description="Ask your trainer to assign you one." />;
  }
  const progressByExercise = new Map(workout.progress.map((p) => [p.exerciseId, p.status]));
  const columns: DataTableColumn<MemberPortalWorkout['workoutPlan']['exercises'][number]>[] = [
    { key: 'name', header: 'Exercise', render: (e) => e.name },
    { key: 'day', header: 'Day', render: (e) => e.dayOfWeek },
    {
      key: 'status',
      header: 'Status',
      render: (e) => {
        const status = progressByExercise.get(e.exerciseId) ?? 'PENDING';
        return <Badge variant={status === 'COMPLETED' ? 'success' : status === 'SKIPPED' ? 'secondary' : 'outline'}>{status}</Badge>;
      },
    },
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {workout.workoutPlan.name} ({workout.status})
      </p>
      <DataTable columns={columns} rows={workout.workoutPlan.exercises} rowKey={(e) => e.exerciseId} emptyMessage="No exercises on this plan." />
      <ViewAllLink href={MEMBER_PORTAL_ROUTES.workout} />
    </div>
  );
}

const STATUS_TONE: Record<string, 'destructive' | 'warning' | 'secondary'> = {
  OVERDUE: 'destructive',
  PARTIALLY_PAID: 'warning',
  UNPAID: 'warning',
};

function OutstandingDetail({ invoices }: { invoices: MemberPortalInvoice[] }) {
  const outstanding = invoices.filter((i) => i.status !== 'PAID');
  const columns: DataTableColumn<MemberPortalInvoice>[] = [
    { key: 'invoice', header: 'Invoice', render: (i) => i.invoiceNumber },
    { key: 'due', header: 'Due', render: (i) => new Date(i.dueDate).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (i) => <Badge variant={STATUS_TONE[i.status] ?? 'secondary'}>{i.status.replace('_', ' ')}</Badge> },
    { key: 'amount', header: 'Amount', render: (i) => `₹${Number(i.totalAmount).toLocaleString('en-IN')}` },
    { key: 'action', header: '', render: (i) => <PayInvoiceButton invoiceId={i.id} invoiceNumber={i.invoiceNumber} /> },
  ];
  return (
    <div className="space-y-3">
      <DataTable columns={columns} rows={outstanding} rowKey={(i) => i.id} emptyMessage="Nothing outstanding — all invoices are settled." />
      <ViewAllLink href={MEMBER_PORTAL_ROUTES.invoices} />
    </div>
  );
}
