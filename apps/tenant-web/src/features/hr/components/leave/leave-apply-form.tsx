'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CalendarPlus, CheckCircle2, Sun, Sunrise, Sunset, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { formatDay, formatRange, todayYmd } from '../../lib/dates';
import { leaveTypeColor, mix } from '../../lib/hr-palette';
import { DAY_PARTS, DAY_PART_LABEL } from '../../lib/status';
import { hrFieldErrors, toHrError, useApplyLeave, useApplyOnBehalf, useEmployees, useLeavePreview, useLeaveTypes, useMeLeaveTypes } from '../../hooks/use-hr';
import type { ApplyLeavePayload, DayPart, LeaveType } from '../../types';
import { AnimatedNumber, FieldLabel, HrPanel, HrTextArea } from '../ui/hr-ui';

const PART_ICON = { FULL_DAY: Sun, HALF_DAY_MORNING: Sunrise, HALF_DAY_EVENING: Sunset } as const;
const PART_HINT: Record<DayPart, string> = { FULL_DAY: 'Whole working day', HALF_DAY_MORNING: 'First half off', HALF_DAY_EVENING: 'Second half off' };

/**
 * Inline (no modal) leave application. `mode="me"` applies for the caller; `mode="manager"` is the apply-on-behalf variant
 * (employee picker + optional auto-approve). The preview is the server's own calculation — days, excluded weekly offs /
 * holidays and balance — so what the user sees is exactly what apply will validate.
 */
export function LeaveApplyForm({ mode, onClose, defaultUserId }: { mode: 'me' | 'manager'; onClose: () => void; defaultUserId?: string }) {
  const m = useMotionSafe();
  const meTypes = useMeLeaveTypes({ enabled: mode === 'me' });
  const mgrTypes = useLeaveTypes(false, { enabled: mode === 'manager' });
  const employees = useEmployees({ limit: 200 }, { enabled: mode === 'manager' });
  const sourceTypes = mode === 'me' ? meTypes.data : mgrTypes.data;
  const types: LeaveType[] = React.useMemo(() => sourceTypes ?? [], [sourceTypes]);

  const [userId, setUserId] = React.useState(defaultUserId ?? '');
  const [typeId, setTypeId] = React.useState('');
  const [dayPart, setDayPart] = React.useState<DayPart>('FULL_DAY');
  const [start, setStart] = React.useState(todayYmd());
  const [end, setEnd] = React.useState(todayYmd());
  const [reason, setReason] = React.useState('');
  const [autoApprove, setAutoApprove] = React.useState(false);
  const [remark, setRemark] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const apply = useApplyLeave();
  const onBehalf = useApplyOnBehalf();
  const submitting = apply.isPending || onBehalf.isPending;

  React.useEffect(() => {
    if (!typeId && types.length) setTypeId(types[0]!.id);
  }, [types, typeId]);

  const half = dayPart !== 'FULL_DAY';
  const effectiveEnd = half ? start : end;
  const rangeOk = !!start && !!effectiveEnd && effectiveEnd >= start;

  const previewPayload = React.useMemo(
    () => (typeId && rangeOk && (mode === 'me' || userId) ? { leaveTypeId: typeId, startDate: start, endDate: effectiveEnd, dayPart, ...(mode === 'manager' ? { userId } : {}) } : null),
    [typeId, rangeOk, mode, userId, start, effectiveEnd, dayPart],
  );
  const preview = useLeavePreview(previewPayload, mode);
  const previewErr = preview.isError ? toHrError(preview.error) : null;
  const selectedType = types.find((t) => t.id === typeId);
  const color = leaveTypeColor(selectedType?.color, types.findIndex((t) => t.id === typeId));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (mode === 'manager' && !userId) next.userId = 'Choose an employee.';
    if (!typeId) next.leaveTypeId = 'Choose a leave type.';
    if (!rangeOk) next.endDate = 'End date cannot be before the start date.';
    if (reason.trim().length < 3) next.reason = 'Please give a reason (at least 3 characters).';
    setErrors(next);
    if (Object.keys(next).length) return;
    const payload: ApplyLeavePayload = { leaveTypeId: typeId, startDate: start, endDate: effectiveEnd, dayPart, reason: reason.trim() };
    try {
      if (mode === 'me') await apply.mutateAsync(payload);
      else await onBehalf.mutateAsync({ ...payload, userId, autoApprove, remark: autoApprove && remark.trim() ? remark.trim() : undefined });
      toast.success(mode === 'me' ? 'Leave request sent for approval.' : autoApprove ? 'Leave applied and approved.' : 'Leave applied on behalf.');
      onClose();
    } catch (err) {
      const fe = hrFieldErrors(err);
      setErrors(fe);
      toast.error(toHrError(err).message);
    }
  };

  return (
    <HrPanel
      title={mode === 'me' ? 'Apply for leave' : 'Apply leave on behalf'}
      subtitle={mode === 'me' ? 'Your manager is notified instantly and you will see their remark here.' : 'HR can apply for any employee, even for past dates.'}
      icon={CalendarPlus}
      tone="var(--chart-7)"
      action={
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close the leave form">
          <X className="size-4" /> Close
        </Button>
      }
    >
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]" noValidate>
        <div className="space-y-4">
          {mode === 'manager' ? (
            <div>
              <FieldLabel htmlFor="lv-emp" required>
                Employee
              </FieldLabel>
              <Select id="lv-emp" value={userId} onChange={(e) => setUserId(e.target.value)} invalid={!!errors.userId} disabled={!!defaultUserId}>
                <option value="">Select an employee...</option>
                {employees.data?.items.map((e) => (
                  <option key={e.userId} value={e.userId}>
                    {e.name} ({e.employeeId})
                  </option>
                ))}
              </Select>
              {errors.userId ? <p className="mt-1 text-xs text-destructive">{errors.userId}</p> : null}
            </div>
          ) : null}

          <fieldset>
            <legend className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Leave type</legend>
            <div className="flex flex-wrap gap-2">
              {types.length === 0 ? <p className="text-sm text-muted-foreground">No leave types available.</p> : null}
              {types.map((t, i) => {
                const c = leaveTypeColor(t.color, i);
                const active = t.id === typeId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTypeId(t.id)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active ? 'shadow-md' : 'hover:bg-accent',
                    )}
                    style={active ? { borderColor: c, backgroundColor: mix(c, 14), color: 'inherit' } : undefined}
                  >
                    <span className="size-3 rounded-full" style={{ backgroundColor: c }} aria-hidden />
                    <span>
                      {t.name}
                      <span className="block text-[11px] font-semibold text-muted-foreground">{t.isPaid ? 'Paid' : 'Unpaid'}{t.yearlyQuota == null ? ' · unlimited' : ` · ${t.yearlyQuota}/yr`}</span>
                    </span>
                    {active ? <CheckCircle2 className="size-4" style={{ color: c }} aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
            {errors.leaveTypeId ? <p className="mt-1 text-xs text-destructive">{errors.leaveTypeId}</p> : null}
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Day part</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Day part">
              {DAY_PARTS.map((p) => {
                const Icon = PART_ICON[p];
                const active = dayPart === p;
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDayPart(p)}
                    className={cn(
                      'relative flex items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active ? 'border-transparent text-white shadow-md' : 'hover:bg-accent',
                    )}
                  >
                    {active ? (
                      <motion.span layoutId="daypart-bg" className="absolute inset-0" style={{ backgroundColor: color }} transition={m.reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }} />
                    ) : null}
                    <span className="relative flex items-center gap-2.5">
                      <Icon className="size-5 shrink-0" aria-hidden />
                      <span>
                        <span className="block text-[13px] font-extrabold">{DAY_PART_LABEL[p]}</span>
                        <span className={cn('block text-[11px]', active ? 'text-white/85' : 'text-muted-foreground')}>{PART_HINT[p]}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="lv-from" required>
                {half ? 'Date' : 'From'}
              </FieldLabel>
              <Input
                id="lv-from"
                type="date"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  if (e.target.value > end) setEnd(e.target.value);
                }}
                invalid={!!(errors.startDate || errors.start)}
              />
              {errors.startDate ? <p className="mt-1 text-xs text-destructive">{errors.startDate}</p> : null}
            </div>
            <div>
              <FieldLabel htmlFor="lv-to" required>
                To
              </FieldLabel>
              <Input id="lv-to" type="date" value={half ? start : end} min={start} disabled={half} onChange={(e) => setEnd(e.target.value)} invalid={!!errors.endDate} />
              {half ? <p className="mt-1 text-[11px] text-muted-foreground">Half days are a single date.</p> : null}
              {errors.endDate ? <p className="mt-1 text-xs text-destructive">{errors.endDate}</p> : null}
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="lv-reason" required>
              Reason
            </FieldLabel>
            <HrTextArea id="lv-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. Family function, medical appointment..." invalid={!!errors.reason} />
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-destructive">{errors.reason}</span>
              <span className="text-muted-foreground">{reason.length}/500</span>
            </div>
          </div>

          {mode === 'manager' ? (
            <div className="rounded-xl border bg-muted/30 p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
                Approve immediately
              </label>
              <AnimatePresence initial={false}>
                {autoApprove ? (
                  <motion.div initial={m.reduce ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={m.reduce ? undefined : { height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="pt-2">
                      <FieldLabel htmlFor="lv-remark">Approval remark (optional)</FieldLabel>
                      <Input id="lv-remark" value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={500} placeholder="Shown to the employee" />
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}
        </div>

        <aside className="space-y-3 lg:border-l lg:pl-5" aria-live="polite" aria-label="Leave summary">
          <div className="rounded-2xl p-4 text-center" style={{ backgroundImage: `linear-gradient(135deg, ${mix(color, 18)}, ${mix(color, 5)})`, boxShadow: `inset 0 0 0 1px ${mix(color, 30)}` }}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">You are taking</p>
            <p className="my-1 text-5xl font-extrabold tabular-nums" style={{ color }}>
              {preview.data ? <AnimatedNumber value={preview.data.days} format={(n) => (Number.isInteger(preview.data!.days) ? String(Math.round(n)) : n.toFixed(1))} /> : '--'}
            </p>
            <p className="text-sm font-bold">{preview.data ? (preview.data.days === 1 ? 'working day' : 'working days') : 'working days'}</p>
            {rangeOk ? <p className="mt-1 text-xs text-muted-foreground">{formatRange(start, effectiveEnd)}{half ? ` · ${DAY_PART_LABEL[dayPart]}` : ''}</p> : null}
          </div>

          {preview.data ? (
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center justify-between rounded-xl border px-3 py-2">
                <span className="text-muted-foreground">Balance before</span>
                <span className="font-extrabold tabular-nums">{preview.data.available == null ? 'Unlimited' : `${preview.data.available} d`}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border px-3 py-2">
                <span className="text-muted-foreground">Balance after</span>
                <span className={cn('font-extrabold tabular-nums', !preview.data.sufficient && 'text-destructive')}>
                  {preview.data.available == null ? 'Unlimited' : `${Math.round((preview.data.available - preview.data.days) * 10) / 10} d`}
                </span>
              </div>
              {!preview.data.sufficient ? (
                <p role="alert" className="flex items-start gap-1.5 rounded-xl bg-destructive/10 px-3 py-2 font-semibold text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> Not enough balance for this request.
                </p>
              ) : null}
              {preview.data.excluded.length ? (
                <div className="rounded-xl border border-dashed px-3 py-2">
                  <p className="mb-1 text-xs font-bold text-muted-foreground">Not counted</p>
                  <ul className="space-y-0.5">
                    {preview.data.excluded.map((x) => (
                      <li key={x.date} className="flex justify-between text-xs">
                        <span>{formatDay(x.date, 'weekday')}</span>
                        <span className="font-semibold text-muted-foreground">{x.reason === 'HOLIDAY' ? x.name ?? 'Holiday' : 'Weekly off'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {previewErr ? (
            <p role="alert" className="flex items-start gap-1.5 rounded-xl bg-destructive/10 px-3 py-2 text-[13px] font-semibold text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {previewErr.message}
            </p>
          ) : null}

          <LoadingButton type="submit" className="w-full" loading={submitting} disabled={!!previewErr || (preview.data ? !preview.data.sufficient : false)}>
            {mode === 'me' ? 'Send request' : autoApprove ? 'Apply and approve' : 'Apply leave'}
          </LoadingButton>
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </aside>
      </form>
    </HrPanel>
  );
}
