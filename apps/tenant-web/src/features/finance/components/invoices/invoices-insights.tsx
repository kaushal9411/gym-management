'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

import { DonutChart, GroupedBarChart, TrendCompareChart } from '@/features/reports/charts';
import { ChartCard } from '@/features/reports/components/ui';
import { useMotionSafe, staggerDelay } from '@/features/reports/lib/motion';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import type { InvoiceAnalytics, MemberInvoiceStatus } from '../../types';
import { INVOICE_STATUS_META } from '../finance-badges';
import { MemberAvatar, fmtDate, num } from '../payments/payments-ui';
import { AGING_COLORS } from './invoice-list-utils';

interface PanelProps {
  analytics: InvoiceAnalytics | undefined;
  loading: boolean;
  compare: boolean;
  previousLabel: string;
}

/** Invoiced over time, this vs previous period. `daily` has no per-day collected series, so Collected is shown in the KPIs only. */
function InvoicedTrend({ analytics, loading, compare, previousLabel }: PanelProps) {
  const data = (analytics?.daily ?? []).map((d) => ({ label: fmtDate(d.date), tip: fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' }), value: num(d.invoiced), previous: num(d.previousInvoiced) }));
  return (
    <ChartCard title="Invoiced over time" subtitle={`Invoice value issued per day${compare ? ' vs previous period' : ''}`} loading={loading} className="flex-[2_1_560px]" minHeight={300}>
      <TrendCompareChart data={data} format="money" color="var(--chart-1)" currentLabel="This period" previousLabel={previousLabel} showPrevious={compare} cumulativeToggle height={270} />
    </ChartCard>
  );
}

function StatusDonut({ analytics, loading }: PanelProps) {
  const sym = useCurrencySymbol();
  const rows = (analytics?.byStatus ?? []).filter((s) => s.count > 0 || num(s.amount) > 0);
  const total = rows.reduce((s, r) => s + num(r.amount), 0);
  return (
    <ChartCard title="By status" subtitle="Invoice value split by status" loading={loading} empty={rows.length === 0} className="flex-[1_1_340px]" minHeight={300}>
      <DonutChart
        data={rows.map((r) => ({ label: `${INVOICE_STATUS_META[r.status as MemberInvoiceStatus]?.label ?? r.status} · ${r.count}`, value: num(r.amount), color: INVOICE_STATUS_META[r.status as MemberInvoiceStatus]?.color }))}
        format="money"
        centerLabel="Invoiced"
        centerValue={formatMoney(sym, total)}
        side={false}
      />
    </ChartCard>
  );
}

function AgingBars({ analytics, loading }: PanelProps) {
  const m = useMotionSafe();
  const sym = useCurrencySymbol();
  const rows = analytics?.aging ?? [];
  const max = Math.max(1, ...rows.map((r) => num(r.amount)));
  const empty = rows.every((r) => num(r.amount) === 0);
  return (
    <ChartCard title="Receivables ageing" subtitle="Unpaid balance by days past due" loading={loading} empty={empty} emptyText="Nothing outstanding" className="flex-[1_1_340px]" minHeight={240}>
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.bucket}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-semibold">
                {r.bucket === 'Current' ? 'Current (not due)' : `${r.bucket} days`} <span className="text-muted-foreground">· {r.count}</span>
              </span>
              <b className="tabular-nums">{formatMoney(sym, r.amount)}</b>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full origin-left rounded-full"
                style={{ width: `${(num(r.amount) / max) * 100}%`, backgroundColor: AGING_COLORS[r.bucket] ?? 'var(--chart-1)' }}
                initial={m.reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, delay: staggerDelay(i, 0.07) }}
              />
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

function TopDebtors({ analytics, loading }: PanelProps) {
  const m = useMotionSafe();
  const sym = useCurrencySymbol();
  const rows = (analytics?.topDebtors ?? []).slice(0, 6);
  return (
    <ChartCard title="Top debtors" subtitle="Members owing the most" loading={loading} empty={rows.length === 0} emptyText="No outstanding balances" className="flex-[1_1_340px]" minHeight={240}>
      <ul>
        {rows.map((d, i) => (
          <motion.li
            key={d.memberId}
            initial={m.reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: staggerDelay(i, 0.05), duration: 0.35 }}
            className={`flex items-center gap-3 py-2.5 ${i > 0 ? 'border-t' : ''}`}
          >
            <span className="w-4 text-center text-xs font-extrabold text-muted-foreground">{i + 1}</span>
            <MemberAvatar name={d.name} seed={d.memberId} size={32} />
            <Link href={`/members/${d.memberId}`} className="min-w-0 flex-1 hover:underline">
              <b className="block truncate text-sm font-semibold">{d.name}</b>
              <span className="block text-xs text-muted-foreground">
                {d.memberCode} · {d.invoiceCount} invoice{d.invoiceCount === 1 ? '' : 's'}
              </span>
            </Link>
            <b className="tabular-nums" style={{ color: 'var(--destructive)' }}>
              {formatMoney(sym, d.outstanding)}
            </b>
          </motion.li>
        ))}
      </ul>
    </ChartCard>
  );
}

function BranchCompare({ analytics, loading }: PanelProps) {
  const rows = analytics?.branches ?? [];
  if (!loading && rows.length < 2) return null; // single branch: nothing to compare
  return (
    <ChartCard title="Branch comparison" subtitle="Invoiced vs collected per branch" loading={loading} className="flex-[1_1_420px]" minHeight={280}>
      <GroupedBarChart data={rows.map((b) => ({ label: b.name, value: num(b.invoiced), previous: num(b.collected) }))} format="money" color="var(--chart-1)" currentLabel="Invoiced" previousLabel="Collected" height={250} />
    </ChartCard>
  );
}

/** All analytics panels; the caller hides the whole section when stats error or the user lacks `finance:invoice-view`. */
export function InvoicesInsights(props: PanelProps) {
  return (
    <>
      <div className="flex flex-wrap gap-3.5">
        <InvoicedTrend {...props} />
        <StatusDonut {...props} />
      </div>
      <div className="flex flex-wrap gap-3.5">
        <AgingBars {...props} />
        <TopDebtors {...props} />
        <BranchCompare {...props} />
      </div>
    </>
  );
}
