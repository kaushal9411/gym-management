'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, CheckCheck, ExternalLink, Eye, Lock, Pencil, RefreshCw, Trash2, Wallet, Banknote } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { RequirePermission } from '@/features/auth/guards/require-permission';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { cn } from '@/lib/utils';
import { formatDateTime, formatMonth } from '../../lib/dates';
import { HR_INK, mix } from '../../lib/hr-palette';
import { inr, toNumber } from '../../lib/money';
import { PAYSLIP_STATUS_TONE, RUN_STATUS_LABEL, RUN_STATUS_TONE } from '../../lib/status';
import { hrService } from '../../services/hr.service';
import { toHrError, useApproveRun, useDeleteRun, usePayrollRun, useRecalcRun } from '../../hooks/use-hr';
import type { Payslip } from '../../types';
import { AnimatedNumber, HrAvatar, HrEmpty, HrError, HrHero, HrPanel, RowsSkeleton, ToneChip } from '../ui/hr-ui';
import { PayAllPanel, PayPanel, PayslipEditPanel } from './payslip-panels';
import { PayslipView } from './payslip-view';

type RowMode = 'edit' | 'pay' | 'view' | null;
type RunAction = 'approve' | 'delete' | 'payall' | null;

const additions = (p: Payslip) => p.fixedAllowances + p.extraAllowances + p.bonus + p.overtimePay;
const deductions = (p: Payslip) => p.attendanceDeduction + p.totalDeductions;

export function PayrollRunPage({ runId }: { runId: string }) {
  const router = useRouter();
  const m = useMotionSafe();
  const q = usePayrollRun(runId);
  const recalc = useRecalcRun();
  const approve = useApproveRun();
  const del = useDeleteRun();
  const [open, setOpen] = React.useState<{ id: string; mode: RowMode } | null>(null);
  const [action, setAction] = React.useState<RunAction>(null);

  const run = q.data?.run;
  const slips = q.data?.payslips ?? [];
  const draft = run?.status === 'DRAFT';
  const approved = run?.status === 'APPROVED';
  const unpaid = slips.filter((s) => s.status !== 'PAID');
  const unpaidTotal = unpaid.reduce((s, p) => s + p.netPay, 0);
  const totals = slips.reduce((t, p) => ({ base: t.base + p.baseSalary, add: t.add + additions(p), ded: t.ded + deductions(p), net: t.net + p.netPay }), { base: 0, add: 0, ded: 0, net: 0 });

  const doRecalc = async () => {
    try {
      await recalc.mutateAsync(runId);
      toast.success('Payslips recalculated from the latest attendance and pay structures.');
    } catch (e) {
      toast.error(toHrError(e).message);
    }
  };
  const doApprove = async () => {
    try {
      await approve.mutateAsync(runId);
      toast.success('Payroll approved and locked. Employees can now see their payslips.');
      setAction(null);
    } catch (e) {
      toast.error(toHrError(e).message);
    }
  };
  const doDelete = async () => {
    try {
      await del.mutateAsync(runId);
      toast.success('Draft payroll deleted.');
      router.replace('/hr/payroll');
    } catch (e) {
      toast.error(toHrError(e).message);
    }
  };

  const toggle = (id: string, mode: RowMode) => setOpen((cur) => (cur && cur.id === id && cur.mode === mode ? null : { id, mode }));

  return (
    <RequirePermission permission="hr:payroll_manage">
      <div className="space-y-3.5">
        {q.isPending ? (
          <RowsSkeleton rows={2} height={150} />
        ) : q.isError ? (
          <HrError message={q.error.message} onRetry={() => void q.refetch()} />
        ) : run ? (
          <>
            <HrHero
              eyebrow="Payroll run"
              icon={Wallet}
              backHref="/hr/payroll"
              backLabel="All payroll runs"
              title={
                <span className="flex flex-wrap items-center gap-3">
                  {formatMonth(run.month)}
                  <span className="inline-flex rounded-full bg-white px-1 py-0.5">
                    <ToneChip tone={RUN_STATUS_TONE[run.status]} label={RUN_STATUS_LABEL[run.status]} />
                  </span>
                </span>
              }
              subtitle={run.status === 'DRAFT' ? 'Review the salary sheet, adjust bonuses or advances, then approve to lock it.' : run.status === 'APPROVED' ? 'Locked. Pay each payslip or everyone at once.' : 'Fully paid and locked.'}
              stats={[
                { label: 'Net payable', value: <AnimatedNumber value={run.totalNet} format={(n) => inr(Math.round(n))} /> },
                { label: 'Employees', value: <AnimatedNumber value={run.employeeCount} /> },
                { label: 'Paid so far', value: <AnimatedNumber value={run.paidAmount} format={(n) => inr(Math.round(n))} /> },
              ]}
              actions={
                <>
                  {draft ? (
                    <>
                      <Button type="button" variant="outline" className="h-11 rounded-xl border-white/30 bg-white/15 text-white hover:bg-white/25 hover:text-white" onClick={doRecalc} disabled={recalc.isPending}>
                        <RefreshCw className={cn('size-4', recalc.isPending && 'animate-spin')} /> Recalculate
                      </Button>
                      <Button type="button" className="h-11 rounded-xl bg-white font-bold hover:bg-white/90" style={{ color: HR_INK }} onClick={() => setAction(action === 'approve' ? null : 'approve')}>
                        <CheckCheck className="size-4" /> Approve run
                      </Button>
                    </>
                  ) : null}
                  {approved && unpaid.length > 0 ? (
                    <Button type="button" className="h-11 rounded-xl bg-white font-bold hover:bg-white/90" style={{ color: HR_INK }} onClick={() => setAction(action === 'payall' ? null : 'payall')}>
                      <Banknote className="size-4" /> Pay all ({unpaid.length})
                    </Button>
                  ) : null}
                </>
              }
            />

            {!draft ? (
              <p className="flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-semibold" style={{ backgroundColor: mix('var(--success)', 8), borderColor: mix('var(--success)', 30) }}>
                <Lock className="size-4 text-[color:var(--success)]" aria-hidden />
                {run.status === 'PAID' ? 'Paid in full - this run is locked.' : `Approved ${run.approvedAt ? formatDateTime(run.approvedAt) : ''}${run.approvedBy ? ` by ${run.approvedBy.name}` : ''} - amounts can no longer be edited.`}
              </p>
            ) : null}

            <AnimatePresence initial={false}>
              {action === 'approve' && draft ? (
                <motion.div key="approve" initial={m.reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={m.reduce ? undefined : { opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="rounded-2xl border bg-card p-4" role="group" aria-label="Approve payroll">
                    <p className="text-sm font-extrabold">Approve {formatMonth(run.month)} payroll?</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {run.employeeCount} payslip{run.employeeCount === 1 ? '' : 's'} totalling <b className="text-foreground">{inr(run.totalNet)}</b> will be locked and become visible to employees. This cannot be undone.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <LoadingButton type="button" variant="success" loading={approve.isPending} onClick={doApprove}>
                        Yes, approve and lock
                      </LoadingButton>
                      <Button type="button" variant="ghost" onClick={() => setAction(null)}>
                        Not yet
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ) : null}
              {action === 'payall' && approved ? (
                <motion.div key="payall" initial={m.reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={m.reduce ? undefined : { opacity: 0, height: 0 }} className="overflow-hidden">
                  <PayAllPanel runId={runId} unpaid={unpaid.length} total={unpaidTotal} onDone={() => setAction(null)} />
                </motion.div>
              ) : null}
              {action === 'delete' && draft ? (
                <motion.div key="delete" initial={m.reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={m.reduce ? undefined : { opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4" role="group" aria-label="Delete draft payroll">
                    <p className="text-sm font-extrabold">Delete this draft?</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">All draft payslips for {formatMonth(run.month)} will be removed. You can generate the month again afterwards.</p>
                    <div className="mt-3 flex gap-2">
                      <LoadingButton type="button" variant="destructive" loading={del.isPending} onClick={doDelete}>
                        Delete draft
                      </LoadingButton>
                      <Button type="button" variant="ghost" onClick={() => setAction(null)}>
                        Keep it
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <HrPanel
              title="Salary sheet"
              subtitle={`${run.paidCount} of ${run.employeeCount} paid`}
              icon={Wallet}
              tone="var(--success)"
              action={
                draft ? (
                  <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setAction(action === 'delete' ? null : 'delete')}>
                    <Trash2 className="size-3.5" /> Delete draft
                  </Button>
                ) : null
              }
            >
              {slips.length === 0 ? (
                <HrEmpty icon={Wallet} title="No payslips" description="No employees were eligible for this month." compact />
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[760px] border-collapse text-[13px]">
                      <caption className="sr-only">Salary sheet for {formatMonth(run.month)}</caption>
                      <thead>
                        <tr className="bg-muted/50 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                          <th scope="col" className="px-3 py-2">Employee</th>
                          <th scope="col" className="px-2 py-2 text-right">Days</th>
                          <th scope="col" className="px-2 py-2 text-right">Base</th>
                          <th scope="col" className="px-2 py-2 text-right">Additions</th>
                          <th scope="col" className="px-2 py-2 text-right">Deductions</th>
                          <th scope="col" className="px-2 py-2 text-right">Net pay</th>
                          <th scope="col" className="px-2 py-2">Status</th>
                          <th scope="col" className="px-3 py-2 text-right"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {slips.map((p) => {
                          const o = open?.id === p.id ? open.mode : null;
                          return (
                            <React.Fragment key={p.id}>
                              <tr className={cn('border-t transition-colors hover:bg-accent/40', o && 'bg-accent/30')}>
                                <td className="px-3 py-2">
                                  <span className="flex items-center gap-2">
                                    <HrAvatar name={p.employee.name} size={28} />
                                    <span className="min-w-0">
                                      <span className="block truncate font-bold">{p.employee.name}</span>
                                      <span className="block text-[11px] text-muted-foreground">{p.employee.employeeId}</span>
                                    </span>
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-right tabular-nums" title={`${p.presentDays} present, ${p.unpaidDays} unpaid of ${p.workingDays} working days`}>
                                  {p.workingDays - p.unpaidDays}/{p.workingDays}
                                </td>
                                <td className="px-2 py-2 text-right tabular-nums">{inr(p.baseSalary)}</td>
                                <td className="px-2 py-2 text-right tabular-nums text-[color:var(--success)]">{additions(p) > 0 ? `+${inr(additions(p))}` : '--'}</td>
                                <td className="px-2 py-2 text-right tabular-nums text-destructive">{deductions(p) > 0 ? `-${inr(deductions(p))}` : '--'}</td>
                                <td className="px-2 py-2 text-right font-extrabold tabular-nums">{inr(p.netPay)}</td>
                                <td className="px-2 py-2">
                                  <ToneChip tone={PAYSLIP_STATUS_TONE[p.status]} label={p.status === 'PAID' ? 'Paid' : 'Draft'} small />
                                  {p.expenseId ? (
                                    <Link href="/expenses" className="mt-0.5 flex items-center gap-0.5 text-[10.5px] font-bold text-primary hover:underline" aria-label={`Expense recorded for ${p.employee.name}`}>
                                      Expense <ExternalLink className="size-2.5" aria-hidden />
                                    </Link>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex justify-end gap-1">
                                    <Button type="button" size="icon" variant="ghost" className="size-8" aria-label={`View payslip of ${p.employee.name}`} aria-pressed={o === 'view'} onClick={() => toggle(p.id, 'view')}>
                                      <Eye className="size-4" />
                                    </Button>
                                    {draft && p.status === 'DRAFT' ? (
                                      <Button type="button" size="icon" variant="ghost" className="size-8" aria-label={`Edit payslip of ${p.employee.name}`} aria-pressed={o === 'edit'} onClick={() => toggle(p.id, 'edit')}>
                                        <Pencil className="size-4" />
                                      </Button>
                                    ) : null}
                                    {approved && p.status === 'DRAFT' ? (
                                      <Button type="button" size="sm" variant={o === 'pay' ? 'default' : 'outline'} aria-pressed={o === 'pay'} onClick={() => toggle(p.id, 'pay')}>
                                        <BadgeCheck className="size-3.5" /> Pay
                                      </Button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                              {o ? (
                                <tr className="border-t bg-muted/20">
                                  <td colSpan={8} className="p-3">
                                    {o === 'edit' ? <PayslipEditPanel slip={p} onDone={() => setOpen(null)} /> : null}
                                    {o === 'pay' ? <PayPanel slip={p} onDone={() => setOpen(null)} /> : null}
                                    {o === 'view' ? <PayslipView slip={p} onPdf={() => hrService.payslipPdf(p.id)} expenseLink /> : null}
                                  </td>
                                </tr>
                              ) : null}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 bg-muted/50 font-extrabold">
                          <th scope="row" className="px-3 py-2.5 text-left">Totals</th>
                          <td />
                          <td className="px-2 py-2.5 text-right tabular-nums"><AnimatedNumber value={totals.base} format={(n) => inr(Math.round(n))} /></td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-[color:var(--success)]"><AnimatedNumber value={totals.add} format={(n) => `+${inr(Math.round(n))}`} /></td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-destructive"><AnimatedNumber value={totals.ded} format={(n) => `-${inr(Math.round(n))}`} /></td>
                          <td className="px-2 py-2.5 text-right tabular-nums"><AnimatedNumber value={totals.net} format={(n) => inr(Math.round(n))} /></td>
                          <td colSpan={2} className="px-2 text-right text-[11px] font-semibold text-muted-foreground">{toNumber(run.paidAmount) > 0 ? `${inr(run.paidAmount)} paid` : ''}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className="mt-2 text-[11.5px] text-muted-foreground">Days = paid days / working days. Deductions include attendance loss, fixed deductions, late penalty and advance recovery.</p>
                </>
              )}
            </HrPanel>
          </>
        ) : null}
      </div>
    </RequirePermission>
  );
}
