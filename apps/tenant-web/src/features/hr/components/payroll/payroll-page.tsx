'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, History, Sparkles, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { Pagination } from '@/components/ui/pagination';
import { LoadingButton } from '@/components/ui/loading-button';
import { RequirePermission } from '@/features/auth/guards/require-permission';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { currentMonth, formatMonth } from '../../lib/dates';
import { mix } from '../../lib/hr-palette';
import { compactInr, inr } from '../../lib/money';
import { RUN_STATUS_LABEL, RUN_STATUS_TONE } from '../../lib/status';
import { toHrError, useGenerateRun, usePayrollRuns } from '../../hooks/use-hr';
import { AnimatedNumber, FieldLabel, HrEmpty, HrError, HrHero, HrPanel, HrTextArea, MonthStepper, RowsSkeleton, StaggerGroup, StaggerItem, ToneChip } from '../ui/hr-ui';

export function PayrollPage() {
  const router = useRouter();
  const m = useMotionSafe();
  const [month, setMonth] = React.useState(currentMonth());
  const [page, setPage] = React.useState(1);
  const [notes, setNotes] = React.useState('');
  const runs = usePayrollRuns({ page, limit: 12 });
  const all = usePayrollRuns({ page: 1, limit: 100 });
  const gen = useGenerateRun();
  const existing = all.data?.items.find((r) => r.month === month);
  const isCurrent = month === currentMonth();

  const generate = async () => {
    try {
      const res = await gen.mutateAsync({ month, notes: notes.trim() || undefined });
      toast.success(`${formatMonth(month)} payroll generated for ${res.run.employeeCount} employees.`);
      router.push(`/hr/payroll/${res.run.id}`);
    } catch (e) {
      toast.error(toHrError(e).message);
    }
  };

  const ytd = (all.data?.items ?? []).filter((r) => r.month.slice(0, 4) === currentMonth().slice(0, 4));
  const ytdNet = ytd.reduce((s, r) => s + r.totalNet, 0);

  return (
    <RequirePermission permission="hr:payroll_manage">
      <div className="space-y-3.5">
        <HrHero
          eyebrow="Payroll"
          icon={Wallet}
          title="Payroll"
          subtitle="Generate a month, tweak bonuses and advances, approve to lock, then pay - each payment lands in Expenses automatically."
          stats={all.data ? [{ label: 'Runs this year', value: <AnimatedNumber value={ytd.length} /> }, { label: 'Net this year', value: <AnimatedNumber value={ytdNet} format={(n) => compactInr(n)} /> }] : undefined}
        />

        <HrPanel title="Pick a month" subtitle="Payroll is generated per calendar month" icon={Sparkles} tone="var(--chart-5)" action={<MonthStepper value={month} onChange={setMonth} max={currentMonth()} />}>
          {all.isPending ? (
            <RowsSkeleton rows={1} height={120} />
          ) : existing ? (
            <motion.div initial={m.reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4" style={{ backgroundImage: `linear-gradient(135deg, ${mix('var(--success)', 10)}, transparent)` }}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-extrabold">{formatMonth(existing.month)}</p>
                  <ToneChip tone={RUN_STATUS_TONE[existing.status]} label={RUN_STATUS_LABEL[existing.status]} />
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {existing.employeeCount} employees · net {inr(existing.totalNet)} · {existing.paidCount} paid
                </p>
              </div>
              <Link href={`/hr/payroll/${existing.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground shadow-xs hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Open salary sheet <ArrowRight className="size-4" aria-hidden />
              </Link>
            </motion.div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="space-y-2">
                <p className="text-[13.5px]">
                  No payroll yet for <b>{formatMonth(month)}</b>. Generating creates a draft payslip for every employee from their attendance, leave and pay structure.
                </p>
                {isCurrent ? <p className="rounded-lg bg-[color:color-mix(in_oklch,var(--warning)_14%,transparent)] px-3 py-1.5 text-xs font-semibold">This month is still running, so the sheet is provisional: days after today count as paid. You can recalculate while it is a draft.</p> : null}
                <div>
                  <FieldLabel htmlFor="run-notes">Note (optional)</FieldLabel>
                  <HrTextArea id="run-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} className="min-h-[52px]" placeholder="Internal note for this run" />
                </div>
              </div>
              <LoadingButton type="button" size="lg" loading={gen.isPending} onClick={generate}>
                <Wallet className="size-5" /> Generate {formatMonth(month, true)}
              </LoadingButton>
            </div>
          )}
        </HrPanel>

        <HrPanel title="Payroll history" icon={History} tone="var(--primary)">
          {runs.isPending ? (
            <RowsSkeleton rows={3} height={84} />
          ) : runs.isError ? (
            <HrError message={runs.error.message} onRetry={() => void runs.refetch()} />
          ) : runs.data.items.length === 0 ? (
            <HrEmpty icon={Wallet} title="No payroll runs yet" description="Generate your first month above." compact />
          ) : (
            <>
              <StaggerGroup className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" step={0.05}>
                {runs.data.items.map((r) => {
                  const pct = r.employeeCount ? (r.paidCount / r.employeeCount) * 100 : 0;
                  return (
                    <StaggerItem key={r.id}>
                      <Link href={`/hr/payroll/${r.id}`} className="block rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-base font-extrabold">{formatMonth(r.month)}</p>
                          <ToneChip tone={RUN_STATUS_TONE[r.status]} label={RUN_STATUS_LABEL[r.status]} small />
                        </div>
                        <p className="mt-1 text-2xl font-extrabold tabular-nums">{inr(r.totalNet)}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.employeeCount} employees · gross {compactInr(r.totalGross)}
                        </p>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${r.paidCount} of ${r.employeeCount} paid`}>
                          <motion.div className="h-full rounded-full" style={{ backgroundColor: 'var(--success)' }} initial={m.reduce ? false : { width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">{r.paidCount} of {r.employeeCount} paid</p>
                      </Link>
                    </StaggerItem>
                  );
                })}
              </StaggerGroup>
              {runs.data.totalPages > 1 ? <div className="mt-3"><Pagination page={page} totalPages={runs.data.totalPages} onPageChange={setPage} totalItems={runs.data.total} pageSize={12} /></div> : null}
            </>
          )}
        </HrPanel>
      </div>
    </RequirePermission>
  );
}
