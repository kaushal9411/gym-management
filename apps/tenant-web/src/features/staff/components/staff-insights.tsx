'use client';

import Link from 'next/link';
import { Clock, KeyRound, Lock, Users } from 'lucide-react';
import { motion } from 'framer-motion';

import { Skeleton } from '@/components/ui/skeleton';
import { type Accent, PanelCard, ProgressBar, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import { useStaffList } from '../hooks/use-staff';
import type { StaffRole, UserStatus, WorkStatus } from '../types';

const STATUS_ORDER: UserStatus[] = ['ACTIVE', 'PENDING_VERIFICATION', 'LOCKED', 'SUSPENDED', 'DEACTIVATED'];
const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  PENDING_VERIFICATION: 'Pending',
  LOCKED: 'Locked',
  SUSPENDED: 'Suspended',
  DEACTIVATED: 'Deactivated',
};
const STATUS_COLOR: Record<UserStatus, string> = {
  ACTIVE: 'var(--success)',
  PENDING_VERIFICATION: 'var(--warning)',
  LOCKED: 'var(--destructive)',
  SUSPENDED: 'var(--chart-3)',
  DEACTIVATED: 'var(--chart-7)',
};
const ROLE_ORDER: StaffRole[] = ['TRAINER', 'RECEPTIONIST', 'MANAGER'];
const ROLE_LABEL: Record<StaffRole, string> = { TRAINER: 'Trainer', RECEPTIONIST: 'Receptionist', MANAGER: 'Manager' };
const ROLE_ACCENT: Record<StaffRole, Accent> = { TRAINER: 'violet', RECEPTIONIST: 'primary', MANAGER: 'aqua' };
const WORK_STATUS_ORDER: WorkStatus[] = ['WORKING', 'ON_LEAVE', 'NOTICE_PERIOD', 'TERMINATED'];
const WORK_STATUS_LABEL: Record<WorkStatus, string> = { WORKING: 'Working', ON_LEAVE: 'On leave', NOTICE_PERIOD: 'Notice period', TERMINATED: 'Terminated' };
const WORK_STATUS_ACCENT: Record<WorkStatus, Accent> = { WORKING: 'success', ON_LEAVE: 'aqua', NOTICE_PERIOD: 'warning', TERMINATED: 'destructive' };

function BarRows({ rows, loading }: { rows: Array<{ label: string; count: number; accent: Accent }>; loading: boolean }) {
  if (loading) return <Skeleton className="h-28 w-full" />;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label} className="space-y-1">
          <div className="flex justify-between text-[12.5px]">
            <b className="font-semibold">{r.label}</b>
            <span className="tabular-nums text-muted-foreground">{r.count}</span>
          </div>
          <ProgressBar percent={(r.count / max) * 100} accent={r.accent} />
        </div>
      ))}
    </div>
  );
}

function PersonGroup({ title, people, accent }: { title: string; people: Array<{ id: string; name: string; detail: string }>; accent: Accent }) {
  if (people.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="space-y-0.5">
        {people.map((p) => (
          <li key={p.id}>
            <Link href={`/staff/${p.id}`} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-accent/50">
              <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(accent)}, var(--chart-7))` }}>
                {p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <b className="block truncate text-[12.5px] font-semibold">{p.name}</b>
                <small className="text-muted-foreground">{p.detail}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/**
 * Every number here comes from the EXISTING `/staff` list endpoint, just
 * called once per status/role/work-status filter (`limit: 1`, only `.total`
 * used) — same approach as `StaffKpis`, no new backend endpoint. React
 * Query dedupes identical calls already made by `StaffKpis` on the same
 * page, so this doesn't double the network cost for the statuses they share.
 */
export function StaffInsights({ branchId }: { branchId?: string }) {
  const active = useStaffList({ page: 1, limit: 1, status: 'ACTIVE', branchId });
  const pending = useStaffList({ page: 1, limit: 1, status: 'PENDING_VERIFICATION', branchId });
  const locked = useStaffList({ page: 1, limit: 1, status: 'LOCKED', branchId });
  const suspended = useStaffList({ page: 1, limit: 1, status: 'SUSPENDED', branchId });
  const deactivated = useStaffList({ page: 1, limit: 1, status: 'DEACTIVATED', branchId, includeDeleted: true });

  const manager = useStaffList({ page: 1, limit: 1, role: 'MANAGER', branchId });
  const trainer = useStaffList({ page: 1, limit: 1, role: 'TRAINER', branchId });
  const receptionist = useStaffList({ page: 1, limit: 1, role: 'RECEPTIONIST', branchId });

  const working = useStaffList({ page: 1, limit: 1, workStatus: 'WORKING', branchId });
  const onLeave = useStaffList({ page: 1, limit: 1, workStatus: 'ON_LEAVE', branchId });
  const noticePeriod = useStaffList({ page: 1, limit: 1, workStatus: 'NOTICE_PERIOD', branchId });
  const terminated = useStaffList({ page: 1, limit: 1, workStatus: 'TERMINATED', branchId });

  const lockedList = useStaffList({ page: 1, limit: 5, status: 'LOCKED', branchId, sortBy: 'createdAt', sortDir: 'desc' });
  const pendingList = useStaffList({ page: 1, limit: 5, status: 'PENDING_VERIFICATION', branchId, sortBy: 'createdAt', sortDir: 'desc' });

  const statusLoading = active.isPending || pending.isPending || locked.isPending || suspended.isPending || deactivated.isPending;
  const byStatus: Record<UserStatus, number> = {
    ACTIVE: active.data?.total ?? 0,
    PENDING_VERIFICATION: pending.data?.total ?? 0,
    LOCKED: locked.data?.total ?? 0,
    SUSPENDED: suspended.data?.total ?? 0,
    DEACTIVATED: deactivated.data?.total ?? 0,
  };
  const total = Object.values(byStatus).reduce((s, n) => s + n, 0);
  let acc = 0;
  const stops = STATUS_ORDER.filter((s) => byStatus[s] > 0).map((s) => {
    const start = acc;
    acc += total > 0 ? (byStatus[s] / total) * 100 : 0;
    return `${STATUS_COLOR[s]} ${start}% ${acc}%`;
  }).join(', ');

  const roleLoading = manager.isPending || trainer.isPending || receptionist.isPending;
  const byRole: Record<StaffRole, number> = { MANAGER: manager.data?.total ?? 0, TRAINER: trainer.data?.total ?? 0, RECEPTIONIST: receptionist.data?.total ?? 0 };

  const workLoading = working.isPending || onLeave.isPending || noticePeriod.isPending || terminated.isPending;
  const byWorkStatus: Record<WorkStatus, number> = {
    WORKING: working.data?.total ?? 0,
    ON_LEAVE: onLeave.data?.total ?? 0,
    NOTICE_PERIOD: noticePeriod.data?.total ?? 0,
    TERMINATED: terminated.data?.total ?? 0,
  };

  const lockedPeople = (lockedList.data?.items ?? []).map((s) => ({ id: s.id, name: s.name, detail: 'Too many failed sign-ins' }));
  const pendingPeople = (pendingList.data?.items ?? []).map((s) => {
    const d = daysAgo(s.createdAt);
    return { id: s.id, name: s.name, detail: d === 0 ? 'Invited today' : `Invited ${d} day${d === 1 ? '' : 's'} ago` };
  });
  const attentionLoading = lockedList.isPending || pendingList.isPending;

  return (
    <section aria-label="Staff reports" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <PanelCard icon={Users} accent="primary" title="Status mix" delay={0.2}>
        {statusLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="grid size-[112px] place-items-center rounded-full" style={{ backgroundImage: total > 0 ? `conic-gradient(${stops})` : `conic-gradient(${tint('primary', 14)} 0 100%)` }} role="img" aria-label={`${byStatus.ACTIVE} active of ${total}`}>
              <div className="grid size-[78px] place-items-center rounded-full bg-card text-center leading-tight">
                <div>
                  <b className="block text-[22px] font-extrabold tabular-nums">{total}</b>
                  <span className="text-[10.5px] text-muted-foreground">staff</span>
                </div>
              </div>
            </div>
            <ul className="grid gap-1.5 text-[12.5px]">
              {STATUS_ORDER.filter((s) => byStatus[s] > 0).map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <i className="size-2.5 rounded-[3px]" style={{ background: STATUS_COLOR[s] }} />
                  {STATUS_LABEL[s]}
                  <b className="ml-auto pl-3 tabular-nums">{byStatus[s]}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </PanelCard>

      <PanelCard icon={KeyRound} accent="violet" title="People by role" delay={0.26}>
        <BarRows loading={roleLoading} rows={ROLE_ORDER.map((r) => ({ label: ROLE_LABEL[r], count: byRole[r], accent: ROLE_ACCENT[r] }))} />
      </PanelCard>

      <PanelCard icon={Clock} accent="aqua" title="Work status" delay={0.32}>
        <BarRows loading={workLoading} rows={WORK_STATUS_ORDER.map((w) => ({ label: WORK_STATUS_LABEL[w], count: byWorkStatus[w], accent: WORK_STATUS_ACCENT[w] }))} />
      </PanelCard>

      <PanelCard icon={Lock} accent="destructive" title="Needs attention" delay={0.38}>
        {attentionLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : lockedPeople.length + pendingPeople.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody needs attention right now.</p>
        ) : (
          <div className="space-y-3">
            <PersonGroup title="Locked account" people={lockedPeople} accent="destructive" />
            <PersonGroup title="Invited, not verified" people={pendingPeople} accent="warning" />
          </div>
        )}
      </PanelCard>
    </section>
  );
}
