'use client';

import * as React from 'react';
import Link from 'next/link';
import { Download, ExternalLink, Printer, ReceiptIndianRupee } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useTenant } from '@/features/tenant/tenant-provider';
import { cn } from '@/lib/utils';
import { formatDateTime, formatDay, formatMinutes, formatMonth } from '../../lib/dates';
import { mix } from '../../lib/hr-palette';
import { inr } from '../../lib/money';
import { paymentModeLabel, PAYSLIP_STATUS_TONE, roleLabel } from '../../lib/status';
import { toHrError } from '../../hooks/use-hr';
import type { Payslip } from '../../types';
import { HrAvatar, ToneChip } from '../ui/hr-ui';

/** Print only the payslip: everything else on the page is hidden by this stylesheet while the dialog is open. */
const PRINT_CSS = `@media print { body * { visibility: hidden !important; } #hr-payslip-print, #hr-payslip-print * { visibility: visible !important; } #hr-payslip-print { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0 !important; box-shadow: none !important; } .no-print { display: none !important; } }`;

function Money({ label, value, sign, strong, muted }: { label: string; value: number; sign?: '+' | '-'; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-1 text-[13.5px]', strong && 'border-t pt-2 font-extrabold', muted && 'text-muted-foreground')}>
      <span>{label}</span>
      <span className={cn('tabular-nums', sign === '-' && value > 0 && 'text-destructive')}>
        {sign === '-' && value > 0 ? '-' : sign === '+' && value > 0 ? '+' : ''}
        {inr(value)}
      </span>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/30 px-2.5 py-2">
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

export function PayslipView({ slip, onPdf, expenseLink }: { slip: Payslip; onPdf: () => Promise<void>; expenseLink?: boolean }) {
  const tenant = useTenant();
  const [busy, setBusy] = React.useState(false);
  const structureLines = slip.lines.filter((l) => l.source === 'STRUCTURE');
  const manualLines = slip.lines.filter((l) => l.source === 'MANUAL');
  const allowances = structureLines.filter((l) => l.type === 'ALLOWANCE');
  const deductions = structureLines.filter((l) => l.type === 'DEDUCTION');
  const extraAllow = manualLines.filter((l) => l.type === 'ALLOWANCE');
  const extraDed = manualLines.filter((l) => l.type === 'DEDUCTION');

  const pdf = async () => {
    setBusy(true);
    try {
      await onPdf();
    } catch (e) {
      toast.error(toHrError(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <style>{PRINT_CSS}</style>
      <div className="no-print flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="size-3.5" /> Print
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={pdf} disabled={busy}>
          <Download className="size-3.5" /> {busy ? 'Opening...' : 'PDF'}
        </Button>
      </div>

      <article id="hr-payslip-print" className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xs" aria-label={`Payslip ${formatMonth(slip.month)}`}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5" style={{ backgroundImage: `linear-gradient(135deg, ${mix('var(--primary)', 10)}, transparent)` }}>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl" style={{ backgroundColor: mix('var(--primary)', 14), color: 'var(--primary)' }}>
              <ReceiptIndianRupee className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{tenant.name}</p>
              <h3 className="text-lg font-extrabold leading-tight">Payslip - {formatMonth(slip.month)}</h3>
            </div>
          </div>
          <ToneChip tone={PAYSLIP_STATUS_TONE[slip.status]} label={slip.status === 'PAID' ? 'Paid' : 'Draft'} />
        </header>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <HrAvatar name={slip.employee.name} size={42} />
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold">{slip.employee.name}</p>
              <p className="text-xs text-muted-foreground">
                {slip.employee.employeeId} · {roleLabel(slip.employee.role)} · {slip.salaryType.charAt(0) + slip.salaryType.slice(1).toLowerCase()} salary
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Fact label="Working days" value={slip.workingDays} />
            <Fact label="Present" value={slip.presentDays} />
            <Fact label="Half days" value={slip.halfDays} />
            <Fact label="Paid leave" value={slip.paidLeaveDays} />
            <Fact label="Unpaid leave" value={slip.unpaidLeaveDays} />
            <Fact label="Absent" value={slip.absentDays} />
            <Fact label="Late marks" value={slip.lateCount} />
            <Fact label="Overtime" value={formatMinutes(slip.overtimeMinutes)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section aria-label="Earnings" className="rounded-xl border p-3.5">
              <h4 className="mb-1 text-xs font-extrabold uppercase tracking-wider text-[color:var(--success)]">Earnings</h4>
              <Money label="Base salary" value={slip.baseSalary} />
              {allowances.map((l) => (
                <Money key={l.id} label={l.name} value={l.amount} sign="+" />
              ))}
              {extraAllow.map((l) => (
                <Money key={l.id} label={`${l.name} (extra)`} value={l.amount} sign="+" />
              ))}
              {slip.bonus > 0 ? <Money label="Bonus" value={slip.bonus} sign="+" /> : null}
              {slip.overtimePay > 0 ? <Money label="Overtime pay" value={slip.overtimePay} sign="+" /> : null}
              {slip.attendanceDeduction > 0 ? <Money label={`Attendance loss (${slip.unpaidDays} unpaid day${slip.unpaidDays === 1 ? '' : 's'} x ${inr(slip.dailyRate)})`} value={slip.attendanceDeduction} sign="-" /> : null}
              <Money label="Gross earnings" value={slip.grossEarnings} strong />
            </section>
            <section aria-label="Deductions" className="rounded-xl border p-3.5">
              <h4 className="mb-1 text-xs font-extrabold uppercase tracking-wider text-destructive">Deductions</h4>
              {deductions.map((l) => (
                <Money key={l.id} label={l.name} value={l.amount} sign="-" />
              ))}
              {extraDed.map((l) => (
                <Money key={l.id} label={`${l.name} (extra)`} value={l.amount} sign="-" />
              ))}
              {slip.latePenalty > 0 ? <Money label="Late penalty" value={slip.latePenalty} sign="-" /> : null}
              {slip.advanceRecovery > 0 ? <Money label="Advance recovery" value={slip.advanceRecovery} sign="-" /> : null}
              {slip.totalDeductions === 0 ? <p className="py-1 text-[13px] text-muted-foreground">No deductions.</p> : null}
              <Money label="Total deductions" value={slip.totalDeductions} strong />
            </section>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3.5 text-white" style={{ backgroundImage: 'linear-gradient(115deg, var(--success), color-mix(in oklch, var(--success) 55%, var(--chart-7)))' }}>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/85">Net pay</p>
              <p className="text-3xl font-extrabold tabular-nums">{inr(slip.netPay)}</p>
            </div>
            <p className="max-w-[260px] text-right text-xs font-semibold text-white/90">
              {inr(slip.grossEarnings)} earnings - {inr(slip.totalDeductions)} deductions
            </p>
          </div>

          {slip.notes.length ? (
            <ul className="space-y-1 rounded-xl border border-dashed bg-[color:color-mix(in_oklch,var(--warning)_8%,transparent)] px-3 py-2 text-xs text-muted-foreground">
              {slip.notes.map((n) => (
                <li key={n}>Note: {n}</li>
              ))}
            </ul>
          ) : null}

          {slip.status === 'PAID' ? (
            <p className="text-[12.5px] text-muted-foreground">
              Paid on <span className="font-bold text-foreground">{slip.paidOn ? `${formatDay(slip.paidOn)} ${slip.paidOn.slice(0, 4)}` : formatDateTime(slip.paidAt)}</span> via <span className="font-bold text-foreground">{paymentModeLabel(slip.paymentMode)}</span>
              {slip.paidBy ? <> by {slip.paidBy.name}</> : null}
              {slip.paidRemark ? <> · &ldquo;{slip.paidRemark}&rdquo;</> : null}
              {expenseLink && slip.expenseId ? (
                <>
                  {' '}
                  ·{' '}
                  <Link href="/expenses" className="no-print inline-flex items-center gap-1 font-bold text-primary hover:underline">
                    Expense recorded <ExternalLink className="size-3" aria-hidden />
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </article>
    </div>
  );
}
