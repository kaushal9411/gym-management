'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { MessageSquareQuote, UserCog } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { formatDateTime, formatRange } from '../../lib/dates';
import { leaveTypeColor, mix } from '../../lib/hr-palette';
import { DAY_PART_SHORT, LEAVE_STATUS_LABEL, LEAVE_STATUS_TONE } from '../../lib/status';
import type { LeaveRequest } from '../../types';
import { HrAvatar, ToneChip } from '../ui/hr-ui';

export function DaysBadge({ days, color }: { days: number; color: string }) {
  return (
    <span className="inline-flex shrink-0 flex-col items-center rounded-xl px-2.5 py-1 leading-tight" style={{ backgroundColor: mix(color, 14), color }}>
      <span className="text-lg font-extrabold tabular-nums">{days}</span>
      <span className="text-[10px] font-bold uppercase">{days === 1 ? 'day' : 'days'}</span>
    </span>
  );
}

/** The approver's decision as a quoted remark bubble. */
export function DecisionNote({ req }: { req: LeaveRequest }) {
  if (req.status === 'PENDING') return null;
  const who = req.decidedBy?.name;
  const rejected = req.status === 'REJECTED';
  const color = rejected ? 'var(--destructive)' : req.status === 'APPROVED' ? 'var(--success)' : 'var(--muted-foreground)';
  const when = req.decidedAt ?? req.cancelledAt;
  if (!req.decisionRemark && !who && !when) return null;
  return (
    <div className="mt-2 flex gap-2 rounded-xl px-3 py-2 text-[13px]" style={{ backgroundColor: mix(color, 9), boxShadow: `inset 3px 0 0 ${color}` }}>
      <MessageSquareQuote className="mt-0.5 size-4 shrink-0" style={{ color }} aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">
          {req.decisionRemark ? <>&ldquo;{req.decisionRemark}&rdquo;</> : <span className="text-muted-foreground">No remark added.</span>}
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          {req.status === 'CANCELLED' ? 'Cancelled' : rejected ? 'Rejected' : 'Approved'}
          {who ? ` by ${who}` : ''}
          {when ? ` · ${formatDateTime(when)}` : ''}
        </p>
      </div>
    </div>
  );
}

export function LeaveRequestCard({
  req,
  index = 0,
  showEmployee,
  footer,
  className,
}: {
  req: LeaveRequest;
  index?: number;
  showEmployee?: boolean;
  footer?: React.ReactNode;
  className?: string;
}) {
  const m = useMotionSafe();
  const color = leaveTypeColor(req.leaveType.color, 0);
  const half = req.dayPart !== 'FULL_DAY';
  return (
    <motion.article
      layout={!m.reduce}
      initial={m.reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.05 }}
      className={cn('relative overflow-hidden rounded-2xl border bg-card p-3.5 shadow-xs', className)}
      style={{ boxShadow: `inset 4px 0 0 ${color}` }}
    >
      <div className="flex flex-wrap items-start gap-3">
        {showEmployee ? <HrAvatar name={req.employee.name} size={38} /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {showEmployee ? (
              <p className="text-sm font-extrabold">
                {req.employee.name} <span className="text-xs font-semibold text-muted-foreground">· {req.employee.employeeId}</span>
              </p>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color }}>
              <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
              {req.leaveType.name}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">{req.leaveType.isPaid ? 'Paid' : 'Unpaid'}</span>
          </div>
          <p className="mt-0.5 text-[13.5px] font-semibold">
            {formatRange(req.startDate, req.endDate)}
            {half ? <span className="ml-1.5 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold">{DAY_PART_SHORT[req.dayPart]}</span> : null}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">{req.reason}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted-foreground">
            <span>Applied {formatDateTime(req.createdAt)}</span>
            {req.appliedOnBehalf ? (
              <span className="inline-flex items-center gap-1 font-semibold text-[color:var(--chart-7)]">
                <UserCog className="size-3" aria-hidden /> by HR ({req.appliedBy.name})
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DaysBadge days={req.days} color={color} />
          <ToneChip tone={LEAVE_STATUS_TONE[req.status]} label={LEAVE_STATUS_LABEL[req.status]} />
        </div>
      </div>
      <DecisionNote req={req} />
      {footer ? <div className="mt-2.5">{footer}</div> : null}
    </motion.article>
  );
}

