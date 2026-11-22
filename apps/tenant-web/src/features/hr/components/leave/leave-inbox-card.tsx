'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Gauge, Undo2, Users, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAppSelector } from '@/store/hooks';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { formatRange } from '../../lib/dates';
import { leaveTypeColor, mix } from '../../lib/hr-palette';
import { hrErrorCode, hrKeys, toHrError, useApproveLeave, useCancelLeave, useLeaveDetail, useRejectLeave } from '../../hooks/use-hr';
import type { LeaveRequest, LeaveRequestDetail } from '../../types';
import { HrTextArea } from '../ui/hr-ui';
import { LeaveRequestCard } from './leave-cards';

type Mode = 'approve' | 'reject' | 'cancel' | null;

function BalanceImpact({ detail }: { detail: LeaveRequestDetail }) {
  const b = detail.balance;
  if (!b) return null;
  const color = leaveTypeColor(b.leaveType.color);
  const unlimited = b.entitled == null;
  const pct = unlimited ? 0 : Math.min(100, ((b.used + b.pending) / Math.max(b.entitled!, 1)) * 100);
  const over = !unlimited && b.available! < 0;
  return (
    <div className="rounded-xl border px-3 py-2 text-[12.5px]" style={{ backgroundColor: mix(color, 6) }}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-bold">
          <Gauge className="size-3.5" aria-hidden /> {b.leaveType.name} balance ({b.leaveYearLabel})
        </span>
        <span className={cn('font-extrabold tabular-nums', over && 'text-destructive')}>{unlimited ? 'Unlimited' : `${b.available} d left`}</span>
      </div>
      {!unlimited ? (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${b.used} used and ${b.pending} pending of ${b.entitled}`}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: over ? 'var(--destructive)' : color }} />
          </div>
          <p className="mt-1 text-muted-foreground">
            {b.used} used · {b.pending} pending (incl. this request) · {b.entitled} entitled
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">{b.used} used · {b.pending} pending</p>
      )}
    </div>
  );
}

/** One request in the HR inbox with inline approve / reject / cancel. Reject needs a remark; approve's is optional. */
export function LeaveInboxCard({ req, index }: { req: LeaveRequest; index: number }) {
  const m = useMotionSafe();
  const qc = useQueryClient();
  const meId = useAppSelector((s) => s.auth.user?.id);
  const isOwn = meId === req.employee.userId;
  const pending = req.status === 'PENDING';
  const detail = useLeaveDetail(pending ? req.id : null);
  const approve = useApproveLeave();
  const reject = useRejectLeave();
  const cancel = useCancelLeave();
  const [mode, setMode] = React.useState<Mode>(null);
  const [remark, setRemark] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const busy = approve.isPending || reject.isPending || cancel.isPending;
  const needsRemark = mode === 'reject' || mode === 'cancel';

  const open = (next: Mode) => {
    setMode(next);
    setRemark('');
    setError(null);
  };

  const submit = async () => {
    const text = remark.trim();
    if (needsRemark && text.length < 3) {
      setError('A remark of at least 3 characters is required.');
      return;
    }
    try {
      if (mode === 'approve') await approve.mutateAsync({ id: req.id, remark: text || undefined });
      else if (mode === 'reject') await reject.mutateAsync({ id: req.id, remark: text });
      else if (mode === 'cancel') await cancel.mutateAsync({ id: req.id, remark: text });
      toast.success(mode === 'approve' ? `Approved - ${req.employee.name} has been notified.` : mode === 'reject' ? 'Request rejected with your remark.' : 'Leave cancelled and attendance restored.');
      setMode(null);
    } catch (e) {
      const code = hrErrorCode(e);
      const msg = toHrError(e).message;
      setError(msg);
      toast.error(msg);
      // Someone else may have decided it already, or the balance changed: show the truth.
      if (code === 'INVALID_STATE' || code === 'INSUFFICIENT_LEAVE_BALANCE' || code === 'LEAVE_OVERLAP') void qc.invalidateQueries({ queryKey: hrKeys.all });
    }
  };

  const conflicts = detail.data?.conflicts ?? [];

  const footer = (
    <div className="space-y-2.5">
      {pending && detail.isPending ? <Skeleton className="h-12 w-full rounded-xl" /> : null}
      {detail.data ? <BalanceImpact detail={detail.data} /> : null}
      {conflicts.length > 0 ? (
        <div role="note" className="rounded-xl border px-3 py-2 text-[12.5px]" style={{ borderColor: mix('var(--warning)', 55), backgroundColor: mix('var(--warning)', 12) }}>
          <p className="mb-1 flex items-center gap-1.5 font-extrabold">
            <AlertTriangle className="size-3.5 text-[color:var(--warning)]" aria-hidden /> Overlaps with {conflicts.length} other {conflicts.length === 1 ? 'person' : 'people'}
          </p>
          <ul className="space-y-0.5">
            {conflicts.map((c) => (
              <li key={c.leaveRequestId} className="flex items-center gap-1.5">
                <Users className="size-3 text-muted-foreground" aria-hidden />
                <span className="font-semibold">{c.employee.name}</span>
                <span className="text-muted-foreground">{formatRange(c.startDate, c.endDate)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pending ? (
        isOwn ? (
          <p className="text-xs font-semibold text-muted-foreground">This is your own request - another approver has to decide it.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={mode === 'approve' ? 'success' : 'outline'} onClick={() => open(mode === 'approve' ? null : 'approve')} aria-expanded={mode === 'approve'}>
              <Check className="size-4" /> Approve
            </Button>
            <Button type="button" size="sm" variant={mode === 'reject' ? 'destructive' : 'outline'} onClick={() => open(mode === 'reject' ? null : 'reject')} aria-expanded={mode === 'reject'}>
              <X className="size-4" /> Reject
            </Button>
          </div>
        )
      ) : req.status === 'APPROVED' && !isOwn ? (
        <Button type="button" size="sm" variant="outline" onClick={() => open(mode === 'cancel' ? null : 'cancel')} aria-expanded={mode === 'cancel'}>
          <Undo2 className="size-3.5" /> Cancel approved leave
        </Button>
      ) : null}

      <AnimatePresence initial={false}>
        {mode ? (
          <motion.div
            key={mode}
            initial={m.reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={m.reduce ? undefined : { opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border bg-muted/30 p-3" style={{ borderColor: mode === 'approve' ? mix('var(--success)', 45) : mix('var(--destructive)', 45) }}>
              <label htmlFor={`remark-${req.id}`} className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {mode === 'approve' ? 'Remark (optional)' : mode === 'reject' ? 'Reason for rejecting' : 'Reason for cancelling'}
                {needsRemark ? <span className="ml-0.5 text-destructive">*</span> : null}
              </label>
              <HrTextArea
                id={`remark-${req.id}`}
                value={remark}
                onChange={(e) => {
                  setRemark(e.target.value);
                  setError(null);
                }}
                maxLength={500}
                invalid={!!error}
                placeholder={mode === 'approve' ? 'e.g. Enjoy! Please hand over open work.' : 'The employee sees this remark.'}
                className="min-h-[60px]"
              />
              {error ? (
                <p role="alert" className="mt-1 text-xs font-semibold text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <LoadingButton type="button" size="sm" variant={mode === 'approve' ? 'success' : 'destructive'} loading={busy} onClick={submit}>
                  {mode === 'approve' ? 'Confirm approval' : mode === 'reject' ? 'Confirm rejection' : 'Confirm cancellation'}
                </LoadingButton>
                <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)} disabled={busy}>
                  Back
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );

  return <LeaveRequestCard req={req} index={index} showEmployee footer={pending || req.status === 'APPROVED' ? footer : null} />;
}
