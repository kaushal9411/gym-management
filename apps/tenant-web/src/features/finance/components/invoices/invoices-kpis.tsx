'use client';

import { AlertTriangle, BarChart3, Clock, FileText, Wallet } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { RadialGauge } from '@/features/reports/charts';
import { useCurrencySymbol } from '@/lib/currency';
import type { InvoiceAnalytics } from '../../types';
import { KpiCard } from '../payments/kpi-strip';
import { DeltaText, num, pctChange } from '../payments/payments-ui';

const GRID = 'grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5';

/** Six KPI tiles from `/invoices/analytics`. Sparklines come from `daily` (only an invoiced/count series exists, so Collected/Outstanding/Overdue have none). */
export function InvoicesKpis({ analytics, loading, compare, vsLabel }: { analytics: InvoiceAnalytics | undefined; loading: boolean; compare: boolean; vsLabel: string }) {
  const sym = useCurrencySymbol();
  if (loading || !analytics) {
    return (
      <section className={GRID}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[170px] rounded-[20px]" />
        ))}
      </section>
    );
  }
  const { kpis, daily } = analytics;
  const vs = compare ? vsLabel : undefined;
  const rate = Math.max(0, Math.min(1, kpis.collectionRate.value));
  const rateDelta = (kpis.collectionRate.value - kpis.collectionRate.previous) * 100;
  const avgSeries = daily.map((d) => (d.count > 0 ? num(d.invoiced) / d.count : 0));
  return (
    <section className={GRID}>
      <KpiCard
        label="Invoiced"
        icon={FileText}
        color="var(--chart-1)"
        value={formatMoney(sym, kpis.invoiced.value)}
        caption={
          compare ? (
            <DeltaText pct={pctChange(num(kpis.invoiced.value), num(kpis.invoiced.previous))} suffix={vs} />
          ) : (
            <span className="text-[12.5px] font-bold text-muted-foreground">{kpis.count.value} invoices</span>
          )
        }
        spark={daily.map((d) => num(d.invoiced))}
      />
      <KpiCard
        label="Collected"
        icon={Wallet}
        color="var(--chart-3)"
        value={formatMoney(sym, kpis.collected.value)}
        caption={compare ? <DeltaText pct={pctChange(num(kpis.collected.value), num(kpis.collected.previous))} suffix={vs} /> : null}
      />
      <div className="min-w-0 rounded-[20px] border bg-card p-[18px] shadow-xs">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Collection rate</span>
        <div className="mt-1.5 flex items-center gap-3.5">
          <RadialGauge value={rate * 100} size={92} thickness={10} color={rate >= 0.8 ? 'var(--chart-3)' : rate >= 0.5 ? 'var(--chart-4)' : 'var(--destructive)'}>
            <span className="text-base font-extrabold tabular-nums">{(rate * 100).toFixed(0)}%</span>
          </RadialGauge>
          <div className="text-[12.5px] font-semibold text-muted-foreground">
            collected of invoiced
            {compare ? (
              <div className="mt-1 font-bold" style={{ color: rateDelta === 0 ? undefined : rateDelta > 0 ? 'var(--success)' : 'var(--destructive)' }}>
                {rateDelta >= 0 ? '▲' : '▼'} {Math.abs(rateDelta).toFixed(1)} pts {vs}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <KpiCard
        label="Outstanding"
        icon={Clock}
        color="var(--chart-4)"
        value={formatMoney(sym, kpis.outstanding.value)}
        caption={<span className="text-[12.5px] font-bold text-muted-foreground">{kpis.outstanding.invoiceCount} open invoice{kpis.outstanding.invoiceCount === 1 ? '' : 's'}</span>}
      />
      <KpiCard
        label="Overdue"
        icon={AlertTriangle}
        color="var(--destructive)"
        value={formatMoney(sym, kpis.overdue.value)}
        caption={<span className="text-[12.5px] font-bold" style={{ color: kpis.overdue.count > 0 ? 'var(--destructive)' : 'var(--muted-foreground)' }}>{kpis.overdue.count} overdue invoice{kpis.overdue.count === 1 ? '' : 's'}</span>}
      />
      <KpiCard
        label="Avg. invoice"
        icon={BarChart3}
        color="var(--chart-7)"
        value={formatMoney(sym, kpis.avgInvoice.value)}
        caption={compare ? <DeltaText pct={pctChange(num(kpis.avgInvoice.value), num(kpis.avgInvoice.previous))} suffix={vs} /> : null}
        spark={avgSeries}
      />
    </section>
  );
}
