'use client';

import * as React from 'react';
import { Eraser, PenLine } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { cn } from '@/lib/utils';
import { formatDay, isoToTimeInput } from '../../lib/dates';
import { mix, TONES } from '../../lib/hr-palette';
import { DAY_STATUS_LABEL, DAY_STATUS_TONE, MARKABLE_STATUSES, TIMED_STATUSES } from '../../lib/status';
import { hrFieldErrors, toHrError, useClearAttendance, useMarkAttendance } from '../../hooks/use-hr';
import type { AttendanceDay, AttendanceStatus } from '../../types';
import { FieldLabel, HrTextArea } from '../ui/hr-ui';

/**
 * Inline manual mark / override for one employee-day. A remark is always required (it is the audit trail); times are
 * only offered for statuses that carry them. Existing record provenance (source + who) is shown so overrides are informed.
 */
export function MarkAttendanceForm({
  userId,
  name,
  date,
  existing,
  onDone,
  onCancel,
}: {
  userId: string;
  name: string;
  date: string;
  existing?: AttendanceDay;
  onDone: () => void;
  onCancel: () => void;
}) {
  const initialStatus: AttendanceStatus = existing && MARKABLE_STATUSES.includes(existing.status as AttendanceStatus) && existing.recorded ? (existing.status as AttendanceStatus) : 'PRESENT';
  const [status, setStatus] = React.useState<AttendanceStatus>(initialStatus);
  const [checkIn, setCheckIn] = React.useState(isoToTimeInput(existing?.checkInAt));
  const [checkOut, setCheckOut] = React.useState(isoToTimeInput(existing?.checkOutAt));
  const [remark, setRemark] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const mark = useMarkAttendance();
  const clear = useClearAttendance();
  const timed = TIMED_STATUSES.includes(status);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (remark.trim().length < 3) next.remark = 'A remark of at least 3 characters is required.';
    if (timed && checkOut && !checkIn) next.checkInTime = 'Add a check-in time before the check-out time.';
    if (timed && checkIn && checkOut && checkOut <= checkIn) next.checkOutTime = 'Check-out must be after check-in.';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await mark.mutateAsync({ userId, date, status, remark: remark.trim(), ...(timed && checkIn ? { checkInTime: checkIn } : {}), ...(timed && checkOut ? { checkOutTime: checkOut } : {}) });
      toast.success(`${name}: marked ${DAY_STATUS_LABEL[status].toLowerCase()} for ${formatDay(date)}.`);
      onDone();
    } catch (err) {
      setErrors(hrFieldErrors(err));
      toast.error(toHrError(err).message);
    }
  };

  const clearRecord = async () => {
    if (remark.trim().length < 3) {
      setErrors({ remark: 'Add a remark explaining why the record is removed.' });
      return;
    }
    try {
      await clear.mutateAsync({ userId, date, remark: remark.trim() });
      toast.success('Record removed - the day falls back to the roster.');
      onDone();
    } catch (err) {
      toast.error(toHrError(err).message);
    }
  };

  return (
    <form onSubmit={save} noValidate className="space-y-3 rounded-2xl border bg-muted/30 p-3.5" aria-label={`Mark attendance for ${name}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-extrabold">
          <PenLine className="size-4" aria-hidden /> Mark {name} · {formatDay(date, 'weekday')}
        </p>
        {existing?.recorded ? (
          <p className="text-xs text-muted-foreground">
            Currently <b>{DAY_STATUS_LABEL[existing.status]}</b> ({existing.source === 'SELF' ? 'self check-in' : existing.source === 'MANUAL' ? `marked by ${existing.markedBy?.name ?? 'HR'}` : 'from approved leave'}) - this will override it.
          </p>
        ) : null}
      </div>

      <fieldset>
        <legend className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Attendance status">
          {MARKABLE_STATUSES.map((s) => {
            const meta = TONES[DAY_STATUS_TONE[s]];
            const Icon = meta.icon;
            const active = s === status;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setStatus(s)}
                className={cn('inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active ? 'text-white shadow-md' : 'hover:bg-accent')}
                style={active ? { backgroundColor: meta.color, borderColor: meta.color } : { color: meta.color, backgroundColor: mix(meta.color, 8) }}
              >
                <Icon className="size-3.5" aria-hidden strokeWidth={2.6} />
                {DAY_STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      </fieldset>

      {timed ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor={`in-${userId}`}>Check in (IST)</FieldLabel>
            <Input id={`in-${userId}`} type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} invalid={!!errors.checkInTime} />
            {errors.checkInTime ? <p className="mt-1 text-xs text-destructive">{errors.checkInTime}</p> : null}
          </div>
          <div>
            <FieldLabel htmlFor={`out-${userId}`}>Check out (IST)</FieldLabel>
            <Input id={`out-${userId}`} type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} invalid={!!errors.checkOutTime} />
            {errors.checkOutTime ? <p className="mt-1 text-xs text-destructive">{errors.checkOutTime}</p> : null}
          </div>
        </div>
      ) : null}

      <div>
        <FieldLabel htmlFor={`rm-${userId}`} required>
          Remark
        </FieldLabel>
        <HrTextArea id={`rm-${userId}`} value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={300} invalid={!!errors.remark} placeholder="Why is this being marked manually? e.g. Forgot to punch in" className="min-h-[56px]" />
        {errors.remark ? (
          <p role="alert" className="mt-1 text-xs font-semibold text-destructive">
            {errors.remark}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <LoadingButton type="submit" size="sm" loading={mark.isPending}>
          Save attendance
        </LoadingButton>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={mark.isPending}>
          Cancel
        </Button>
        {existing?.recorded ? (
          <LoadingButton type="button" size="sm" variant="outline" className="ml-auto" loading={clear.isPending} onClick={clearRecord}>
            <Eraser className="size-3.5" /> Remove record
          </LoadingButton>
        ) : null}
      </div>
    </form>
  );
}
