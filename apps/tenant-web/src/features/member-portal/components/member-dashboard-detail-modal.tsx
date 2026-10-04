'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { MEMBER_PORTAL_ROUTES } from '../constants';
import { usePortalMoney } from '../lib/format';
import { ListRow, PortalList, StatusChip } from './kit/list';
import { SheetModal } from './kit/sheet-modal';
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
    <SheetModal open={kind !== null} onOpenChange={(open) => !open && onClose()} title={kind ? TITLES[kind] : 'Details'} className="max-w-2xl">
      {kind === 'membership' ? <MembershipDetail membership={membership} /> : null}
      {kind === 'attendance' ? <AttendanceDetail items={attendanceItems} /> : null}
      {kind === 'workout' ? <WorkoutDetail workout={workout} /> : null}
      {kind === 'outstanding' ? <OutstandingDetail invoices={invoices} /> : null}
    </SheetModal>
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
  if (items.length === 0) return <EmptyState title="No visits recorded yet." />;
  return (
    <div className="space-y-3">
      <PortalList className="-mx-1 rounded-xl border">
        {items.slice(0, 20).map((a) => (
          <ListRow
            key={a.id}
            title={new Date(a.attendanceDate).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
            subtitle={`${a.branch.name} · ${new Date(a.checkInTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${a.checkOutTime ? ` - ${new Date(a.checkOutTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}`}
          />
        ))}
      </PortalList>
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
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {workout.workoutPlan.name} ({workout.status})
      </p>
      {workout.workoutPlan.exercises.length === 0 ? (
        <EmptyState title="No exercises on this plan." />
      ) : (
        <PortalList className="-mx-1 rounded-xl border">
          {workout.workoutPlan.exercises.map((e) => {
            const status = progressByExercise.get(e.exerciseId) ?? 'PENDING';
            return <ListRow key={e.exerciseId} title={e.name} subtitle={e.dayOfWeek} trailing={<StatusChip tone={status === 'COMPLETED' ? 'success' : 'muted'}>{status}</StatusChip>} />;
          })}
        </PortalList>
      )}
      <ViewAllLink href={MEMBER_PORTAL_ROUTES.workout} />
    </div>
  );
}

function OutstandingDetail({ invoices }: { invoices: MemberPortalInvoice[] }) {
  const money = usePortalMoney();
  const outstanding = invoices.filter((i) => i.status !== 'PAID');
  return (
    <div className="space-y-3">
      {outstanding.length === 0 ? (
        <EmptyState title="Nothing outstanding — all invoices are settled." />
      ) : (
        <ul className="space-y-2">
          {outstanding.map((i) => (
            <li key={i.id} className="flex items-center gap-3 rounded-xl border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.invoiceNumber}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Due {new Date(i.dueDate).toLocaleDateString()} · <StatusChip tone={i.status === 'OVERDUE' ? 'danger' : 'warning'}>{i.status.replace('_', ' ')}</StatusChip>
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{money.format(i.totalAmount)}</span>
              <PayInvoiceButton invoiceId={i.id} invoiceNumber={i.invoiceNumber} />
            </li>
          ))}
        </ul>
      )}
      <ViewAllLink href={MEMBER_PORTAL_ROUTES.invoices} />
    </div>
  );
}
