'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarPlus, Plane, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { Pagination } from '@/components/ui/pagination';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { leaveTypeColor } from '../../lib/hr-palette';
import { LEAVE_STATUS_LABEL } from '../../lib/status';
import { toHrError, useCancelMyLeave, useMeBalances, useMeLeaves } from '../../hooks/use-hr';
import type { LeaveRequest, LeaveStatus } from '../../types';
import { LeaveApplyForm } from '../leave/leave-apply-form';
import { LeaveRequestCard } from '../leave/leave-cards';
import { BalanceRing, HrEmpty, HrError, HrPanel, Pill, RowsSkeleton, StaggerGroup, StaggerItem } from '../ui/hr-ui';

function CancelControl({ req }: { req: LeaveRequest }) {
  const m = useMotionSafe();
  const cancel = useCancelMyLeave();
  const [open, setOpen] = React.useState(false);
  const [remark, setRemark] = React.useState('');
  const doCancel = async () => {
    try {
      await cancel.mutateAsync({ id: req.id, remark: remark.trim() || undefined });
      toast.success('Leave request cancelled.');
      setOpen(false);
    } catch (e) {
      toast.error(toHrError(e).message);
    }
  };
  return (
    <div>
      {!open ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Undo2 className="size-3.5" /> Cancel request
        </Button>
      ) : (
        <AnimatePresence>
          <motion.div initial={m.reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex flex-wrap items-end gap-2 overflow-hidden rounded-xl border bg-muted/30 p-2.5">
            <div className="min-w-[200px] flex-1">
              <label htmlFor={`cancel-${req.id}`} className="mb-1 block text-xs font-bold text-muted-foreground">
                Reason for cancelling (optional)
              </label>
              <Input id={`cancel-${req.id}`} value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={300} />
            </div>
            <LoadingButton type="button" size="sm" variant="destructive" loading={cancel.isPending} onClick={doCancel}>
              Confirm cancel
            </LoadingButton>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Keep it
            </Button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

const FILTERS: (LeaveStatus | 'ALL')[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

export function MyLeavesTab({ canApply }: { canApply: boolean }) {
  const summary = useMeBalances();
  const [applying, setApplying] = React.useState(false);
  const [status, setStatus] = React.useState<LeaveStatus | 'ALL'>('ALL');
  const [page, setPage] = React.useState(1);
  const list = useMeLeaves({ status: status === 'ALL' ? undefined : status, page, limit: 8 });

  return (
    <div className="space-y-3.5">
      <HrPanel
        title="Leave balances"
        subtitle={summary.data ? `Leave year ${summary.data.leaveYearLabel}` : undefined}
        icon={Plane}
        tone="var(--chart-7)"
        action={
          canApply && !applying ? (
            <Button type="button" onClick={() => setApplying(true)}>
              <CalendarPlus className="size-4" /> Apply leave
            </Button>
          ) : null
        }
      >
        {summary.isPending ? (
          <RowsSkeleton rows={1} height={110} />
        ) : summary.isError ? (
          <HrError onRetry={() => void summary.refetch()} />
        ) : summary.data.balances.length === 0 ? (
          <HrEmpty icon={Plane} title="No leave types yet" description="Your manager has not set up leave types." compact />
        ) : (
          <StaggerGroup className="flex flex-wrap gap-x-6 gap-y-4">
            {summary.data.balances.map((b, i) => (
              <StaggerItem key={b.leaveType.id}>
                <div className="text-center">
                  <BalanceRing
                    unlimited={b.entitled == null}
                    remaining={b.available ?? b.used}
                    total={b.entitled ?? Math.max(b.used + b.pending, 1)}
                    color={leaveTypeColor(b.leaveType.color, i)}
                    label={b.leaveType.name}
                  />
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {b.available == null ? `Unlimited · ${b.used} used` : `${b.used} used${b.pending ? ` · ${b.pending} pending` : ''}`}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}
      </HrPanel>

      {applying && canApply ? <LeaveApplyForm mode="me" onClose={() => setApplying(false)} /> : null}

      <HrPanel
        title="My leave history"
        subtitle="Every request with your manager's decision and remark"
        icon={CalendarPlus}
        tone="var(--primary)"
        action={
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <Pill
                key={f}
                active={status === f}
                onClick={() => {
                  setStatus(f);
                  setPage(1);
                }}
              >
                {f === 'ALL' ? 'All' : LEAVE_STATUS_LABEL[f]}
              </Pill>
            ))}
          </div>
        }
      >
        {list.isPending ? (
          <RowsSkeleton rows={3} height={92} />
        ) : list.isError ? (
          <HrError onRetry={() => void list.refetch()} />
        ) : list.data.items.length === 0 ? (
          <HrEmpty icon={Plane} title="No leave requests" description={status === 'ALL' ? 'When you apply for leave it shows up here with its status.' : 'Nothing with this status.'} compact />
        ) : (
          <div className="space-y-2.5">
            {list.data.items.map((r, i) => (
              <LeaveRequestCard key={r.id} req={r} index={i} footer={r.canCancel ? <CancelControl req={r} /> : null} />
            ))}
            {list.data.totalPages > 1 ? <Pagination page={page} totalPages={list.data.totalPages} onPageChange={setPage} totalItems={list.data.total} pageSize={8} /> : null}
          </div>
        )}
      </HrPanel>
    </div>
  );
}
