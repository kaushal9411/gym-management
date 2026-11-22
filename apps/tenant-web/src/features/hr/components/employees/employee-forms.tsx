'use client';

import * as React from 'react';
import { Gauge, Plus, Trash2, Wallet, Clock3 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { mix } from '../../lib/hr-palette';
import { inr } from '../../lib/money';
import { WEEKDAYS } from '../../lib/status';
import { hrFieldErrors, toHrError, useAdjustBalance, usePayStructure, useSavePayStructure, useSetWorkSetup, useShifts } from '../../hooks/use-hr';
import type { EmployeeListItem, LeaveBalance, PayComponentType, Weekday } from '../../types';
import { AnimatedNumber, FieldLabel, HrError, HrPanel, HrTextArea, RowsSkeleton } from '../ui/hr-ui';

/** Shift + weekly-off assignment (`PUT work-setup`). `null` = inherit. */
export function WorkSetupForm({ employee, canEdit }: { employee: EmployeeListItem; canEdit: boolean }) {
  const shifts = useShifts();
  const save = useSetWorkSetup();
  const [shiftId, setShiftId] = React.useState<string>(employee.shift?.id ?? '');
  const [inherit, setInherit] = React.useState(false);
  const [off, setOff] = React.useState<Weekday[]>(employee.weeklyOff);

  const toggle = (d: Weekday) => setOff((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  const submit = async () => {
    try {
      await save.mutateAsync({ userId: employee.userId, payload: { shiftId: shiftId || null, weeklyOff: inherit ? null : off } });
      toast.success('Work setup updated.');
    } catch (e) {
      toast.error(toHrError(e).message);
    }
  };

  return (
    <HrPanel title="Shift & weekly off" subtitle="Drives late marks, leave days and payroll" icon={Clock3} tone="var(--chart-3)">
      <div className="space-y-3">
        <div>
          <FieldLabel htmlFor="ws-shift">Shift</FieldLabel>
          <Select id="ws-shift" value={shiftId} onChange={(e) => setShiftId(e.target.value)} disabled={!canEdit}>
            <option value="">Gym default shift</option>
            {shifts.data?.filter((s) => s.isActive).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.startTime}-{s.endTime})
              </option>
            ))}
          </Select>
        </div>
        <fieldset disabled={!canEdit || inherit}>
          <legend className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Weekly off days</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = off.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(d.value)}
                  className={cn('h-9 min-w-[48px] rounded-xl border px-2.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60', on ? 'border-transparent text-white' : 'hover:bg-accent')}
                  style={on ? { backgroundColor: 'var(--chart-3)' } : undefined}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
        </fieldset>
        {canEdit ? (
          <>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={inherit} onChange={(e) => setInherit(e.target.checked)} />
              Inherit weekly off from the shift / gym policy
            </label>
            <LoadingButton type="button" size="sm" loading={save.isPending} onClick={submit}>
              Save work setup
            </LoadingButton>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">You can view this but not change it.</p>
        )}
      </div>
    </HrPanel>
  );
}

interface Row {
  key: number;
  name: string;
  type: PayComponentType;
  amount: string;
  isActive: boolean;
}

/** Pay structure: base + allowance/deduction components. `components` replaces the whole set on save. */
export function PayStructureEditor({ userId }: { userId: string }) {
  const q = usePayStructure(userId);
  const save = useSavePayStructure();
  const nextKey = React.useRef(1);
  const [base, setBase] = React.useState('');
  const [rows, setRows] = React.useState<Row[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const seeded = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!q.data || seeded.current === `${userId}:${q.dataUpdatedAt}`) return;
    seeded.current = `${userId}:${q.dataUpdatedAt}`;
    setBase(q.data.baseSalary == null ? '' : String(q.data.baseSalary));
    setRows(q.data.components.map((c) => ({ key: nextKey.current++, name: c.name, type: c.type, amount: String(c.amount), isActive: c.isActive !== false })));
  }, [q.data, q.dataUpdatedAt, userId]);

  const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const gross = num(base) + rows.filter((r) => r.type === 'ALLOWANCE' && r.isActive).reduce((s, r) => s + num(r.amount), 0);
  const fixedDed = rows.filter((r) => r.type === 'DEDUCTION' && r.isActive).reduce((s, r) => s + num(r.amount), 0);
  const patch = (key: number, p: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const submit = async () => {
    const next: Record<string, string> = {};
    if (base !== '' && num(base) < 0) next.baseSalary = 'Cannot be negative.';
    rows.forEach((r, i) => {
      if (!r.name.trim()) next[`row${i}`] = 'Name the component.';
      else if (!(num(r.amount) >= 0) || r.amount === '') next[`row${i}`] = 'Enter an amount.';
    });
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await save.mutateAsync({
        userId,
        payload: { ...(base !== '' ? { baseSalary: num(base) } : {}), components: rows.map((r) => ({ name: r.name.trim(), type: r.type, amount: num(r.amount), isActive: r.isActive })) },
      });
      toast.success('Pay structure saved. It applies to the next payroll run.');
    } catch (e) {
      setErrors(hrFieldErrors(e));
      toast.error(toHrError(e).message);
    }
  };

  return (
    <HrPanel title="Pay structure" subtitle={q.data ? `${q.data.salaryType.charAt(0) + q.data.salaryType.slice(1).toLowerCase()} salary` : 'Salary, allowances and fixed deductions'} icon={Wallet} tone="var(--success)">
      {q.isPending ? (
        <RowsSkeleton rows={3} height={44} />
      ) : q.isError ? (
        <HrError message={q.error.message} onRetry={() => void q.refetch()} />
      ) : (
        <div className="space-y-4">
          <div className="max-w-xs">
            <FieldLabel htmlFor="ps-base">Base salary (₹)</FieldLabel>
            <Input id="ps-base" type="number" min={0} step="0.01" inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} invalid={!!errors.baseSalary} />
            {errors.baseSalary ? <p className="mt-1 text-xs text-destructive">{errors.baseSalary}</p> : null}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Components</p>
            {rows.length === 0 ? <p className="text-[13px] text-muted-foreground">No allowances or fixed deductions.</p> : null}
            {rows.map((r, i) => (
              <div key={r.key} className="grid grid-cols-[1fr_auto] items-start gap-2 rounded-xl border p-2 sm:grid-cols-[minmax(0,1fr)_130px_130px_auto_auto]" style={{ backgroundColor: mix(r.type === 'ALLOWANCE' ? 'var(--success)' : 'var(--destructive)', 5) }}>
                <Input aria-label="Component name" placeholder="e.g. Travel allowance" value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} maxLength={60} invalid={!!errors[`row${i}`]} className="col-span-2 sm:col-span-1" />
                <Select aria-label="Component type" value={r.type} onChange={(e) => patch(r.key, { type: e.target.value as PayComponentType })}>
                  <option value="ALLOWANCE">Allowance (+)</option>
                  <option value="DEDUCTION">Deduction (-)</option>
                </Select>
                <Input aria-label="Amount" type="number" min={0} step="0.01" inputMode="decimal" value={r.amount} onChange={(e) => patch(r.key, { amount: e.target.value })} placeholder="Amount" />
                <label className="flex h-10 items-center gap-1.5 text-xs font-semibold">
                  <input type="checkbox" className="size-4" checked={r.isActive} onChange={(e) => patch(r.key, { isActive: e.target.checked })} /> Active
                </label>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${r.name || 'component'}`} onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
                {errors[`row${i}`] ? <p className="col-span-full text-xs text-destructive">{errors[`row${i}`]}</p> : null}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setRows((x) => [...x, { key: nextKey.current++, name: '', type: 'ALLOWANCE', amount: '', isActive: true }])} disabled={rows.length >= 20}>
              <Plus className="size-4" /> Add component
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border bg-muted/30 p-2.5">
              <p className="text-[10.5px] font-bold uppercase text-muted-foreground">Monthly gross</p>
              <p className="text-lg font-extrabold tabular-nums"><AnimatedNumber value={gross} format={(n) => inr(Math.round(n))} /></p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-2.5">
              <p className="text-[10.5px] font-bold uppercase text-muted-foreground">Fixed deductions</p>
              <p className="text-lg font-extrabold tabular-nums text-destructive"><AnimatedNumber value={fixedDed} format={(n) => inr(Math.round(n))} /></p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-2.5">
              <p className="text-[10.5px] font-bold uppercase text-muted-foreground">Net (before attendance)</p>
              <p className="text-lg font-extrabold tabular-nums text-[color:var(--success)]"><AnimatedNumber value={Math.max(0, gross - fixedDed)} format={(n) => inr(Math.round(n))} /></p>
            </div>
          </div>
          <LoadingButton type="button" loading={save.isPending} onClick={submit}>
            Save pay structure
          </LoadingButton>
        </div>
      )}
    </HrPanel>
  );
}

/** Credit / debit a leave balance with a mandatory remark. */
export function BalanceAdjustForm({ userId, balances, onClose }: { userId: string; balances: LeaveBalance[]; onClose: () => void }) {
  const adjust = useAdjustBalance();
  const [typeId, setTypeId] = React.useState(balances.find((b) => b.entitled != null)?.leaveType.id ?? '');
  const [dir, setDir] = React.useState<'credit' | 'debit'>('credit');
  const [days, setDays] = React.useState('1');
  const [remark, setRemark] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(days);
    const next: Record<string, string> = {};
    if (!typeId) next.leaveTypeId = 'Choose a leave type.';
    if (!(n > 0)) next.days = 'Enter a number of days above 0.';
    if (remark.trim().length < 3) next.remark = 'A remark of at least 3 characters is required.';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await adjust.mutateAsync({ userId, leaveTypeId: typeId, days: dir === 'credit' ? n : -n, remark: remark.trim() });
      toast.success(`${dir === 'credit' ? 'Credited' : 'Debited'} ${n} day${n === 1 ? '' : 's'}.`);
      onClose();
    } catch (err) {
      setErrors(hrFieldErrors(err));
      toast.error(toHrError(err).message);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-2xl border bg-muted/30 p-3.5" aria-label="Adjust leave balance">
      <p className="flex items-center gap-1.5 text-sm font-extrabold">
        <Gauge className="size-4" aria-hidden /> Adjust leave balance
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <FieldLabel htmlFor="adj-type">Leave type</FieldLabel>
          <Select id="adj-type" value={typeId} onChange={(e) => setTypeId(e.target.value)} invalid={!!errors.leaveTypeId}>
            {balances.filter((b) => b.entitled != null).map((b) => b.leaveType).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel>Action</FieldLabel>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Credit or debit">
            {(['credit', 'debit'] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={dir === d}
                onClick={() => setDir(d)}
                className={cn('h-10 flex-1 rounded-lg border text-[13px] font-bold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', dir === d ? 'border-transparent text-white' : 'hover:bg-accent')}
                style={dir === d ? { backgroundColor: d === 'credit' ? 'var(--success)' : 'var(--destructive)' } : undefined}
              >
                {d === 'credit' ? '+ Credit' : '- Debit'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="adj-days">Days</FieldLabel>
          <Input id="adj-days" type="number" min={0.5} step={0.5} value={days} onChange={(e) => setDays(e.target.value)} invalid={!!errors.days} />
          {errors.days ? <p className="mt-1 text-xs text-destructive">{errors.days}</p> : null}
        </div>
      </div>
      <div>
        <FieldLabel htmlFor="adj-remark" required>
          Remark
        </FieldLabel>
        <HrTextArea id="adj-remark" value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={300} invalid={!!errors.remark} className="min-h-[56px]" placeholder="e.g. Comp-off for working on Diwali" />
        {errors.remark ? <p className="mt-1 text-xs font-semibold text-destructive">{errors.remark}</p> : null}
      </div>
      <div className="flex gap-2">
        <LoadingButton type="submit" size="sm" loading={adjust.isPending}>
          Apply adjustment
        </LoadingButton>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
