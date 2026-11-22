'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { Select } from '@/components/ui/select';
import { todayYmd } from '../../lib/dates';
import { inr } from '../../lib/money';
import { PAYMENT_MODES } from '../../lib/status';
import { hrFieldErrors, toHrError, usePatchPayslip, usePayAll, usePayPayslip } from '../../hooks/use-hr';
import type { PayAllResult, PayComponentType, PaymentMode, Payslip } from '../../types';
import { FieldLabel, HrTextArea } from '../ui/hr-ui';

interface LineRow {
  key: number;
  name: string;
  type: PayComponentType;
  amount: string;
}

/** Inline editor for a DRAFT payslip: bonus, advance recovery and extra allowance / deduction lines. */
export function PayslipEditPanel({ slip, onDone }: { slip: Payslip; onDone: () => void }) {
  const patch = usePatchPayslip();
  const nextKey = React.useRef(1);
  const [bonus, setBonus] = React.useState(String(slip.bonus || ''));
  const [advance, setAdvance] = React.useState(String(slip.advanceRecovery || ''));
  const [remark, setRemark] = React.useState('');
  const [rows, setRows] = React.useState<LineRow[]>(() =>
    slip.lines.filter((l) => l.source === 'MANUAL').map((l) => ({ key: nextKey.current++, name: l.name, type: l.type, amount: String(l.amount) })),
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const n = (v: string) => (v === '' ? 0 : Number(v));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!(n(bonus) >= 0)) next.bonus = 'Must be 0 or more.';
    if (!(n(advance) >= 0)) next.advanceRecovery = 'Must be 0 or more.';
    rows.forEach((r, i) => {
      if (!r.name.trim()) next[`line${i}`] = 'Name this line.';
      else if (!(n(r.amount) > 0)) next[`line${i}`] = 'Amount must be above 0.';
    });
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await patch.mutateAsync({
        id: slip.id,
        payload: { bonus: n(bonus), advanceRecovery: n(advance), manualLines: rows.map((r) => ({ name: r.name.trim(), type: r.type, amount: n(r.amount) })), ...(remark.trim() ? { remark: remark.trim() } : {}) },
      });
      toast.success(`${slip.employee.name}'s payslip recalculated.`);
      onDone();
    } catch (err) {
      setErrors(hrFieldErrors(err));
      toast.error(toHrError(err).message);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-2xl border bg-muted/30 p-3.5" aria-label={`Edit payslip of ${slip.employee.name}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`bonus-${slip.id}`}>Bonus (₹)</FieldLabel>
          <Input id={`bonus-${slip.id}`} type="number" min={0} step="0.01" inputMode="decimal" value={bonus} onChange={(e) => setBonus(e.target.value)} invalid={!!errors.bonus} />
          {errors.bonus ? <p className="mt-1 text-xs text-destructive">{errors.bonus}</p> : null}
        </div>
        <div>
          <FieldLabel htmlFor={`adv-${slip.id}`}>Advance recovery (₹)</FieldLabel>
          <Input id={`adv-${slip.id}`} type="number" min={0} step="0.01" inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} invalid={!!errors.advanceRecovery} />
          {errors.advanceRecovery ? <p className="mt-1 text-xs text-destructive">{errors.advanceRecovery}</p> : null}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Extra allowances / deductions</p>
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-[1fr_auto] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_150px_130px_auto]">
            <Input aria-label="Line name" placeholder="e.g. Incentive" value={r.name} maxLength={60} onChange={(e) => setRows((x) => x.map((y) => (y.key === r.key ? { ...y, name: e.target.value } : y)))} className="col-span-2 sm:col-span-1" />
            <Select aria-label="Line type" value={r.type} onChange={(e) => setRows((x) => x.map((y) => (y.key === r.key ? { ...y, type: e.target.value as PayComponentType } : y)))}>
              <option value="ALLOWANCE">Allowance (+)</option>
              <option value="DEDUCTION">Deduction (-)</option>
            </Select>
            <Input aria-label="Line amount" type="number" min={0} step="0.01" inputMode="decimal" placeholder="Amount" value={r.amount} onChange={(e) => setRows((x) => x.map((y) => (y.key === r.key ? { ...y, amount: e.target.value } : y)))} />
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${r.name || 'line'}`} onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
            {errors[`line${i}`] ? <p className="col-span-full text-xs text-destructive">{errors[`line${i}`]}</p> : null}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" disabled={rows.length >= 20} onClick={() => setRows((x) => [...x, { key: nextKey.current++, name: '', type: 'ALLOWANCE', amount: '' }])}>
          <Plus className="size-4" /> Add line
        </Button>
      </div>
      <div>
        <FieldLabel htmlFor={`pr-${slip.id}`}>Note (optional)</FieldLabel>
        <HrTextArea id={`pr-${slip.id}`} value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={200} className="min-h-[48px]" />
      </div>
      <div className="flex gap-2">
        <LoadingButton type="submit" size="sm" loading={patch.isPending}>
          Save and recalculate
        </LoadingButton>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function PayFields({ id, mode, setMode, paidOn, setPaidOn, remark, setRemark }: { id: string; mode: PaymentMode; setMode: (m: PaymentMode) => void; paidOn: string; setPaidOn: (v: string) => void; remark: string; setRemark: (v: string) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <FieldLabel htmlFor={`mode-${id}`} required>
          Payment mode
        </FieldLabel>
        <Select id={`mode-${id}`} value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
          {PAYMENT_MODES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <FieldLabel htmlFor={`on-${id}`}>Paid on</FieldLabel>
        <Input id={`on-${id}`} type="date" value={paidOn} max={todayYmd()} onChange={(e) => setPaidOn(e.target.value)} />
      </div>
      <div>
        <FieldLabel htmlFor={`rm-${id}`}>Reference (optional)</FieldLabel>
        <Input id={`rm-${id}`} value={remark} maxLength={200} onChange={(e) => setRemark(e.target.value)} placeholder="e.g. Txn ref 123" />
      </div>
    </div>
  );
}

/** Mark one payslip paid. Creates exactly one Salary expense on the server. */
export function PayPanel({ slip, onDone }: { slip: Payslip; onDone: () => void }) {
  const pay = usePayPayslip();
  const [mode, setMode] = React.useState<PaymentMode>('UPI');
  const [paidOn, setPaidOn] = React.useState(todayYmd());
  const [remark, setRemark] = React.useState('');
  const submit = async () => {
    try {
      await pay.mutateAsync({ id: slip.id, payload: { paymentMode: mode, paidOn, ...(remark.trim() ? { remark: remark.trim() } : {}) } });
      toast.success(`${slip.employee.name} paid ${inr(slip.netPay)}. A salary expense was recorded.`);
      onDone();
    } catch (e) {
      toast.error(toHrError(e).message);
    }
  };
  return (
    <div className="space-y-3 rounded-2xl border bg-muted/30 p-3.5" role="group" aria-label={`Pay ${slip.employee.name}`}>
      <p className="text-sm font-extrabold">
        Pay {inr(slip.netPay)} to {slip.employee.name}
      </p>
      <PayFields id={slip.id} mode={mode} setMode={setMode} paidOn={paidOn} setPaidOn={setPaidOn} remark={remark} setRemark={setRemark} />
      <p className="text-xs text-muted-foreground">Marking paid records one Salary expense and locks this payslip.</p>
      <div className="flex gap-2">
        <LoadingButton type="button" size="sm" variant="success" loading={pay.isPending} onClick={submit}>
          Mark as paid
        </LoadingButton>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Pay every unpaid payslip of an approved run in one go. */
export function PayAllPanel({ runId, unpaid, total, onDone }: { runId: string; unpaid: number; total: number; onDone: () => void }) {
  const payAll = usePayAll();
  const [mode, setMode] = React.useState<PaymentMode>('BANK_TRANSFER');
  const [paidOn, setPaidOn] = React.useState(todayYmd());
  const [remark, setRemark] = React.useState('');
  const [result, setResult] = React.useState<PayAllResult | null>(null);
  const submit = async () => {
    try {
      const res = await payAll.mutateAsync({ runId, payload: { paymentMode: mode, paidOn, ...(remark.trim() ? { remark: remark.trim() } : {}) } });
      setResult(res);
      if (res.failed.length === 0) toast.success(`${res.paid} payslip${res.paid === 1 ? '' : 's'} paid.`);
      else toast.warning(`${res.paid} paid, ${res.failed.length} failed.`);
    } catch (e) {
      toast.error(toHrError(e).message);
    }
  };
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4" role="group" aria-label="Pay all payslips">
      <p className="text-sm font-extrabold">
        Pay all {unpaid} unpaid payslip{unpaid === 1 ? '' : 's'} ({inr(total)})
      </p>
      {result ? (
        <div className="space-y-2 text-[13px]">
          <p>
            <b>{result.paid}</b> paid · <b>{result.skipped}</b> already paid · <b className={result.failed.length ? 'text-destructive' : ''}>{result.failed.length}</b> failed
          </p>
          {result.failed.length ? (
            <ul className="list-disc pl-5 text-destructive">
              {result.failed.map((f) => (
                <li key={f.payslipId}>{f.message}</li>
              ))}
            </ul>
          ) : null}
          <Button type="button" size="sm" onClick={onDone}>
            Done
          </Button>
        </div>
      ) : (
        <>
          <PayFields id="all" mode={mode} setMode={setMode} paidOn={paidOn} setPaidOn={setPaidOn} remark={remark} setRemark={setRemark} />
          <div className="flex gap-2">
            <LoadingButton type="button" variant="success" loading={payAll.isPending} onClick={submit}>
              Pay all now
            </LoadingButton>
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
