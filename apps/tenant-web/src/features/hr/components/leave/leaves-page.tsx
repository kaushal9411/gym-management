'use client';

import * as React from 'react';
import { AnimatePresence } from 'framer-motion';
import { CalendarDays, CalendarPlus, Inbox, ListFilter, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { RequirePermission } from '@/features/auth/guards/require-permission';
import { SegmentedTabs } from '@/features/reports/components/ui';
import { LEAVE_STATUS_LABEL, useHrAccess } from '../../lib/status';
import { useEmployees, useLeaves, useLeaveTypes } from '../../hooks/use-hr';
import type { LeaveStatus } from '../../types';
import { HeroButton, HrEmpty, HrError, HrHero, HrPanel, Pill, RowsSkeleton, AnimatedNumber, FieldLabel } from '../ui/hr-ui';
import { LeaveApplyForm } from './leave-apply-form';
import { LeaveInboxCard } from './leave-inbox-card';
import { TeamLeaveCalendar } from './team-calendar';

type View = 'requests' | 'calendar';
const STATUSES: (LeaveStatus | 'ALL')[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'];

function RequestsView() {
  const [status, setStatus] = React.useState<LeaveStatus | 'ALL'>('PENDING');
  const [userId, setUserId] = React.useState('');
  const [typeId, setTypeId] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const employees = useEmployees({ limit: 200 });
  const types = useLeaveTypes(true);
  const q = useLeaves({ status: status === 'ALL' ? undefined : status, userId: userId || undefined, leaveTypeId: typeId || undefined, from: from || undefined, to: to || undefined, page, limit: 10 });
  const counts = q.data?.counts;
  const countOf = (s: LeaveStatus | 'ALL') => (!counts ? undefined : s === 'ALL' ? counts.pending + counts.approved + counts.rejected + counts.cancelled : counts[s.toLowerCase() as 'pending' | 'approved' | 'rejected' | 'cancelled']);
  const filtered = !!(userId || typeId || from || to);
  const reset = () => {
    setUserId('');
    setTypeId('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <div className="space-y-3.5">
      <HrPanel title="Filters" icon={ListFilter} tone="var(--primary)" action={filtered ? <Button type="button" variant="ghost" size="sm" onClick={reset}><RotateCcw className="size-3.5" /> Reset</Button> : null}>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
          {STATUSES.map((s) => (
            <Pill
              key={s}
              active={status === s}
              color={s === 'PENDING' ? 'var(--warning)' : s === 'APPROVED' ? 'var(--success)' : s === 'REJECTED' ? 'var(--destructive)' : undefined}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
            >
              {s === 'ALL' ? 'All' : LEAVE_STATUS_LABEL[s]}
              {countOf(s) !== undefined ? <span className="rounded-full bg-black/10 px-1.5 text-[11px] tabular-nums">{countOf(s)}</span> : null}
            </Pill>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <FieldLabel htmlFor="lf-emp">Employee</FieldLabel>
            <Select id="lf-emp" value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1); }}>
              <option value="">Everyone</option>
              {employees.data?.items.map((e) => (
                <option key={e.userId} value={e.userId}>{e.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="lf-type">Leave type</FieldLabel>
            <Select id="lf-type" value={typeId} onChange={(e) => { setTypeId(e.target.value); setPage(1); }}>
              <option value="">All types</option>
              {types.data?.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="lf-from">From</FieldLabel>
            <Input id="lf-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <FieldLabel htmlFor="lf-to">To</FieldLabel>
            <Input id="lf-to" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
        </div>
      </HrPanel>

      {q.isPending ? (
        <RowsSkeleton rows={3} height={150} />
      ) : q.isError ? (
        <HrError message={q.error.message} onRetry={() => void q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <HrEmpty icon={Inbox} title={status === 'PENDING' && !filtered ? 'Inbox zero' : 'No requests found'} description={status === 'PENDING' && !filtered ? 'No leave requests are waiting for a decision.' : 'Try a different status or clear the filters.'} />
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {q.data.items.map((r, i) => (
              <LeaveInboxCard key={r.id} req={r} index={i} />
            ))}
          </AnimatePresence>
          {q.data.totalPages > 1 ? <Pagination page={page} totalPages={q.data.totalPages} onPageChange={setPage} totalItems={q.data.total} pageSize={10} /> : null}
        </div>
      )}
    </div>
  );
}

export function LeavesPage() {
  const access = useHrAccess();
  const [view, setView] = React.useState<View>('requests');
  const [applying, setApplying] = React.useState(false);
  const pending = useLeaves({ status: 'PENDING', limit: 1 }, { enabled: access.leaveManage });

  return (
    <RequirePermission permission="hr:leave_manage">
      <div className="space-y-3.5">
        <HrHero
          eyebrow="Leave management"
          icon={CalendarDays}
          title="Leave requests"
          subtitle="Approve or reject with a remark, apply on someone's behalf and see who is off when."
          stats={pending.data ? [{ label: 'Waiting for a decision', value: <AnimatedNumber value={pending.data.counts.pending} /> }, { label: 'Approved', value: <AnimatedNumber value={pending.data.counts.approved} /> }, { label: 'Rejected', value: <AnimatedNumber value={pending.data.counts.rejected} /> }] : undefined}
          actions={
            <HeroButton solid onClick={() => setApplying((v) => !v)} aria-expanded={applying}>
              <CalendarPlus className="size-4" aria-hidden /> Apply on behalf
            </HeroButton>
          }
        />
        {applying ? <LeaveApplyForm mode="manager" onClose={() => setApplying(false)} /> : null}
        <SegmentedTabs
          ariaLabel="Leave views"
          value={view}
          onChange={setView}
          accent="analytics"
          options={[
            { value: 'requests', label: 'Requests', icon: Inbox },
            { value: 'calendar', label: 'Team calendar', icon: CalendarDays },
          ]}
        />
        {view === 'requests' ? <RequestsView /> : <TeamLeaveCalendar />}
      </div>
    </RequirePermission>
  );
}
