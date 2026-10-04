'use client';

import * as React from 'react';
import { BarChart3, CalendarDays, Clock, DollarSign, RotateCcw, type LucideIcon } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import type { PaymentAnalytics } from '../../types';
import { DeltaText, Sparkline, num, pctChange } from './payments-ui';

export interface KpiCardProps {
  label: string;
  icon: LucideIcon;
  color: string;
  value: string;
  caption: React.ReactNode;
  spark?: number[];
}

export function KpiCard({ label, icon: Icon, color, value, caption, spark }: KpiCardProps) {
  return (
    <div className="min-w-0 rounded-[20px] border bg-card p-[18px] shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="flex size-[34px] items-center justify-center rounded-[10px]" style={{ backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`, color }}>
          <Icon className="size-[17px]" aria-hidden />
        </span>
      </div>
      <div className="mb-0.5 mt-2.5 truncate text-[28px] font-extrabold tabular-nums" title={value}>
        {value}
      </div>
      <div className="min-h-[18px]">{caption}</div>
      {spark ? <Sparkline values={spark} color={color} /> : <div className="mt-2.5 h-[34px]" />}
    </div>
  );
}

export function KpiStrip({ analytics, loading, error, compare, vsLabel }: { analytics: PaymentAnalytics | undefined; loading: boolean; error: boolean; compare: boolean; vsLabel: string }) {
  const sym = useCurrencySymbol();
  const grid = 'grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5';
  if (loading) {
    return (
      <section className={grid}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[170px] rounded-[20px]" />
        ))}
      </section>
    );
  }
  if (error || !analytics) {
    return (
      <section className="rounded-[20px] border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
        Payment analytics are unavailable right now — the list below still works.
      </section>
    );
  }
  const { kpis, daily } = analytics;
  const collectedSeries = daily.map((d) => num(d.collected));
  const refundedSeries = daily.map((d) => num(d.refunded));
  const countSeries = daily.map((d) => d.count);
  const avgSeries = daily.map((d) => (d.count > 0 ? num(d.collected) / d.count : 0));
  const vs = compare ? vsLabel : undefined;

  return (
    <section className={grid}>
      <KpiCard
        label="Collected"
        icon={DollarSign}
        color="var(--chart-1)"
        value={formatMoney(sym, kpis.collected.value)}
        caption={compare ? <DeltaText pct={pctChange(num(kpis.collected.value), num(kpis.collected.previous))} suffix={vs} /> : null}
        spark={collectedSeries}
      />
      <KpiCard
        label="Today"
        icon={CalendarDays}
        color="var(--chart-3)"
        value={formatMoney(sym, kpis.todayCollected.value)}
        caption={<span className="text-[12.5px] font-bold text-muted-foreground">{kpis.todayCollected.count} payment{kpis.todayCollected.count === 1 ? '' : 's'} today</span>}
        spark={countSeries}
      />
      <KpiCard
        label="Outstanding"
        icon={Clock}
        color="var(--chart-4)"
        value={formatMoney(sym, kpis.outstanding.value)}
        caption={<span className="text-[12.5px] font-bold text-muted-foreground">{kpis.outstanding.invoiceCount} unpaid invoice{kpis.outstanding.invoiceCount === 1 ? '' : 's'}</span>}
      />
      <KpiCard
        label="Refunded"
        icon={RotateCcw}
        color="var(--chart-8)"
        value={formatMoney(sym, kpis.refunded.value)}
        caption={
          <span className="text-[12.5px]">
            {compare ? <DeltaText pct={pctChange(num(kpis.refunded.value), num(kpis.refunded.previous))} goodWhenDown /> : null}{' '}
            <span className="font-semibold text-muted-foreground">{compare ? '· ' : ''}refund rate {(kpis.refunded.rate * 100).toFixed(1)}%</span>
          </span>
        }
        spark={refundedSeries}
      />
      <KpiCard
        label="Avg. payment"
        icon={BarChart3}
        color="var(--chart-7)"
        value={formatMoney(sym, kpis.avgPayment.value)}
        caption={compare ? <DeltaText pct={pctChange(num(kpis.avgPayment.value), num(kpis.avgPayment.previous))} suffix={vs} /> : null}
        spark={avgSeries}
      />
    </section>
  );
}
