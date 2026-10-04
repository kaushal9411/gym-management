'use client';

import * as React from 'react';
import { BarChart3, Crown, Hash, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import { KpiCard } from '../payments/kpi-strip';
import { DeltaText, fmtDate, num, pctChange } from '../payments/payments-ui';
import type { LedgerAnalytics } from '../../types';
import type { LedgerTheme } from './ledger-theme';

interface Props {
  analytics: LedgerAnalytics | undefined;
  loading: boolean;
  error: boolean;
  compare: boolean;
  vsLabel: string;
  theme: LedgerTheme;
}

/** Five KPI cards for the ledger pages. Sparklines come from `daily`; "Largest" and "Net profit" have no daily series, so they get none. */
export function LedgerKpiStrip({ analytics, loading, error, compare, vsLabel, theme }: Props) {
  const sym = useCurrencySymbol();
  const grid = 'grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5';
  const Noun = theme.noun[0]!.toUpperCase() + theme.noun.slice(1);
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
        {Noun} analytics are unavailable right now — the list below still works.
      </section>
    );
  }
  const { kpis, daily } = analytics;
  const vs = compare ? vsLabel : undefined;
  const largest = kpis.largest;
  const largestMeta = largest ? theme.categoryMeta[largest.category] : undefined;
  const net = num(kpis.netProfit.value);

  return (
    <section className={grid}>
      <KpiCard
        label={`Total ${theme.noun}`}
        icon={theme.kind === 'income' ? TrendingUp : TrendingDown}
        color={theme.accent}
        value={formatMoney(sym, kpis.total.value)}
        caption={compare ? <DeltaText pct={pctChange(num(kpis.total.value), num(kpis.total.previous))} goodWhenDown={theme.goodWhenDown} suffix={vs} /> : null}
        spark={daily.map((d) => num(d.total))}
      />
      <KpiCard
        label="Entries"
        icon={Hash}
        color="var(--chart-1)"
        value={String(kpis.count.value)}
        caption={compare ? <DeltaText pct={pctChange(kpis.count.value, kpis.count.previous)} suffix={vs} /> : null}
        spark={daily.map((d) => d.count)}
      />
      <KpiCard
        label="Average"
        icon={BarChart3}
        color="var(--chart-7)"
        value={formatMoney(sym, kpis.average.value)}
        caption={compare ? <DeltaText pct={pctChange(num(kpis.average.value), num(kpis.average.previous))} suffix={vs} /> : null}
        spark={daily.map((d) => (d.count > 0 ? num(d.total) / d.count : 0))}
      />
      <KpiCard
        label={`Largest ${theme.noun}`}
        icon={Crown}
        color="var(--chart-4)"
        value={largest ? formatMoney(sym, largest.value) : '—'}
        caption={
          <span className="block truncate text-[12.5px] font-bold text-muted-foreground" title={largest?.description ?? undefined}>
            {largest ? `${largest.description || largestMeta?.label || largest.category} · ${fmtDate(largest.date)}` : `No ${theme.nounPlural} yet`}
          </span>
        }
      />
      <KpiCard
        label="Net profit"
        icon={Wallet}
        color={net >= 0 ? 'var(--success)' : 'var(--destructive)'}
        value={formatMoney(sym, kpis.netProfit.value)}
        caption={compare ? <DeltaText pct={pctChange(net, num(kpis.netProfit.previous))} suffix={vs} /> : <span className="text-[12.5px] font-bold text-muted-foreground">Income − expenses</span>}
      />
    </section>
  );
}
