'use client';

import * as React from 'react';
import { ScrollText } from 'lucide-react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { WEEKDAYS } from '../../lib/status';
import { hrFieldErrors, toHrError, usePolicy, useSavePolicy } from '../../hooks/use-hr';
import type { Policy, Weekday } from '../../types';
import { FieldLabel, HrError, HrPanel, RowsSkeleton } from '../ui/hr-ui';
import { SwitchRow } from './setup-ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function NumberField({ id, label, hint, value, onChange, step = 1, min = 0, error, disabled }: { id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; step?: number; min?: number; error?: string; disabled?: boolean }) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type="number" min={min} step={step} value={value} onChange={(e) => onChange(e.target.value)} invalid={!!error} disabled={disabled} />
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PolicyForm({ policy, canEdit }: { policy: Policy; canEdit: boolean }) {
  const save = useSavePolicy();
  const [f, setF] = React.useState(() => ({
    leaveYearStartMonth: String(policy.leaveYearStartMonth),
    lateGraceMinutes: String(policy.lateGraceMinutes),
    halfDayThresholdHours: String(policy.halfDayThresholdHours),
    standardDayHours: String(policy.standardDayHours),
    latePenaltyEnabled: policy.latePenaltyEnabled,
    latePenaltyLatesPerUnit: String(policy.latePenaltyLatesPerUnit),
    latePenaltyDays: String(policy.latePenaltyDays),
    overtimeEnabled: policy.overtimeEnabled,
    overtimeMultiplier: String(policy.overtimeMultiplier),
    backdateLeaveDays: String(policy.backdateLeaveDays),
    defaultWeeklyOff: policy.defaultWeeklyOff,
  }));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const num = (k: keyof typeof f, label: string, min = 0) => {
      const n = Number(f[k]);
      if (!Number.isFinite(n) || n < min) next[k] = `${label} must be ${min} or more.`;
      return n;
    };
    const payload = {
      leaveYearStartMonth: Number(f.leaveYearStartMonth),
      lateGraceMinutes: num('lateGraceMinutes', 'Grace'),
      halfDayThresholdHours: num('halfDayThresholdHours', 'Threshold'),
      standardDayHours: num('standardDayHours', 'Day length', 1),
      latePenaltyEnabled: f.latePenaltyEnabled,
      latePenaltyLatesPerUnit: num('latePenaltyLatesPerUnit', 'Lates per unit', 1),
      latePenaltyDays: num('latePenaltyDays', 'Penalty days'),
      overtimeEnabled: f.overtimeEnabled,
      overtimeMultiplier: num('overtimeMultiplier', 'Multiplier', 1),
      backdateLeaveDays: num('backdateLeaveDays', 'Back-date window'),
      defaultWeeklyOff: f.defaultWeeklyOff,
    };
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await save.mutateAsync(payload);
      toast.success('HR policy saved.');
    } catch (err) {
      setErrors(hrFieldErrors(err));
      toast.error(toHrError(err).message);
    }
  };

  const off = (d: Weekday) => set('defaultWeeklyOff', f.defaultWeeklyOff.includes(d) ? f.defaultWeeklyOff.filter((x) => x !== d) : [...f.defaultWeeklyOff, d]);

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <fieldset disabled={!canEdit || save.isPending} className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Leave year & attendance rules</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <FieldLabel htmlFor="po-month">Leave year starts in</FieldLabel>
              <Select id="po-month" value={f.leaveYearStartMonth} onChange={(e) => set('leaveYearStartMonth', e.target.value)} invalid={!!errors.leaveYearStartMonth}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </Select>
              {errors.leaveYearStartMonth ? <p className="mt-1 text-xs text-destructive">{errors.leaveYearStartMonth}</p> : <p className="mt-1 text-[11px] text-muted-foreground">Locked once leave requests exist.</p>}
            </div>
            <NumberField id="po-grace" label="Late grace (minutes)" hint="When an employee has no shift" value={f.lateGraceMinutes} onChange={(v) => set('lateGraceMinutes', v)} error={errors.lateGraceMinutes} />
            <NumberField id="po-half" label="Half-day below (hours)" hint="Worked time under this is a half day" value={f.halfDayThresholdHours} onChange={(v) => set('halfDayThresholdHours', v)} step={0.5} error={errors.halfDayThresholdHours} />
            <NumberField id="po-std" label="Standard day (hours)" hint="Overtime and hourly-rate basis" value={f.standardDayHours} onChange={(v) => set('standardDayHours', v)} step={0.5} min={1} error={errors.standardDayHours} />
            <NumberField id="po-back" label="Back-date leave (days)" hint="How far back employees may apply" value={f.backdateLeaveDays} onChange={(v) => set('backdateLeaveDays', v)} error={errors.backdateLeaveDays} />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Default weekly off</legend>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const on = f.defaultWeeklyOff.includes(d.value);
                return (
                  <button key={d.value} type="button" aria-pressed={on} onClick={() => off(d.value)} className={cn('h-9 min-w-[48px] rounded-xl border px-2.5 text-[13px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60', on ? 'border-transparent text-white' : 'hover:bg-accent')} style={on ? { backgroundColor: 'var(--chart-3)' } : undefined}>
                    {d.short}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Payroll adjustments</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border p-3.5">
              <SwitchRow title="Late penalty" hint="Deduct pay for repeated late marks" checked={f.latePenaltyEnabled} onChange={(v) => set('latePenaltyEnabled', v)} />
              <div className="grid grid-cols-2 gap-3">
                <NumberField id="po-lpu" label="Lates per penalty" value={f.latePenaltyLatesPerUnit} onChange={(v) => set('latePenaltyLatesPerUnit', v)} min={1} disabled={!f.latePenaltyEnabled} error={errors.latePenaltyLatesPerUnit} />
                <NumberField id="po-lpd" label="Penalty (days of pay)" value={f.latePenaltyDays} onChange={(v) => set('latePenaltyDays', v)} step={0.25} disabled={!f.latePenaltyEnabled} error={errors.latePenaltyDays} />
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border p-3.5">
              <SwitchRow title="Overtime pay" hint="Pay extra beyond the standard day" checked={f.overtimeEnabled} onChange={(v) => set('overtimeEnabled', v)} />
              <NumberField id="po-ot" label="Overtime multiplier" value={f.overtimeMultiplier} onChange={(v) => set('overtimeMultiplier', v)} step={0.25} min={1} disabled={!f.overtimeEnabled} error={errors.overtimeMultiplier} />
            </div>
          </div>
        </section>
      </fieldset>
      {canEdit ? (
        <LoadingButton type="submit" loading={save.isPending}>
          Save policy
        </LoadingButton>
      ) : (
        <p className="text-xs text-muted-foreground">You can view the policy but not change it.</p>
      )}
    </form>
  );
}

export function PolicyPanel({ canEdit }: { canEdit: boolean }) {
  const q = usePolicy();
  return (
    <HrPanel title="HR policy" subtitle="Rules that drive attendance status, leave counting and payroll" icon={ScrollText} tone="var(--chart-2)">
      {q.isPending ? <RowsSkeleton rows={3} height={64} /> : q.isError ? <HrError message={q.error.message} onRetry={() => void q.refetch()} /> : <PolicyForm key={JSON.stringify(q.data)} policy={q.data} canEdit={canEdit} />}
    </HrPanel>
  );
}
