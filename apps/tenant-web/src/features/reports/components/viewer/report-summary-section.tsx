'use client';

import * as React from 'react';
import { Hash, Percent, Type, Wallet } from 'lucide-react';

import { DonutChart, HBarChart, TrendCompareChart } from '../../charts';
import { num, shortDate, type ValueFormat } from '../../lib/format';
import { accentColor, seriesColor, type ReportAccent } from '../../lib/reports-theme';
import type { ReportSummary, ReportSummaryBreakdown, ReportSummaryKpi } from '../../types';
import { ChartCard, KpiTile, StaggerGroup, StaggerItem } from '../ui';

const MONEY_HINT = /revenue|expense|collected|amount|income|spend|paid|price/i;
/** Breakdowns/series carry no explicit format in the contract, so money is inferred from the title. */
const formatFromTitle = (title: string): ValueFormat => (MONEY_HINT.test(title) ? 'money' : 'number');
const INVERT = /expense|churn|outstanding|overdue|refund|expiring|inactive|failed/i;

const FORMAT_ICON = { money: Wallet, percent: Percent, number: Hash, text: Type } as const;

function kpiNumber(k: ReportSummaryKpi): number {
  return num(k.value);
}

function KpiStrip({ kpis, accent, compare }: { kpis: ReportSummaryKpi[]; accent: ReportAccent; compare: boolean }) {
  return (
    <StaggerGroup className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {kpis.map((k) =>
        k.format === 'text' ? (
          <StaggerItem key={k.key}>
            <div className="h-full rounded-[20px] border bg-card p-4 shadow-xs sm:p-5">
              <p className="truncate text-xs font-bold uppercase tracking-wider text-muted-foreground">{k.label}</p>
              <p className="mt-2 truncate text-xl font-extrabold">{String(k.value)}</p>
            </div>
          </StaggerItem>
        ) : (
          <KpiTile
            key={k.key}
            label={k.label}
            value={kpiNumber(k)}
            format={k.format}
            previous={compare && k.previous !== undefined ? num(k.previous) : undefined}
            invert={INVERT.test(`${k.key} ${k.label}`)}
            icon={FORMAT_ICON[k.format]}
            accent={accent}
            compact={k.format === 'money'}
          />
        ),
      )}
    </StaggerGroup>
  );
}

function BreakdownCard({ b, accent, compare }: { b: ReportSummaryBreakdown; accent: ReportAccent; compare: boolean }) {
  const format = formatFromTitle(b.title);
  const total = b.items.reduce((s, i) => s + i.value, 0);
  return (
    <ChartCard title={b.title} subtitle={b.kind === 'bar' && compare && b.items.some((i) => i.previous !== undefined) ? 'Tick marks show the previous period' : undefined} empty={b.items.length === 0 || (total === 0 && !b.items.some((i) => i.previous))} minHeight={200}>
      {b.kind === 'donut' ? (
        <DonutChart data={b.items.map((i, idx) => ({ label: i.label, value: i.value, color: seriesColor(idx) }))} format={format} />
      ) : (
        <HBarChart data={b.items.map((i) => ({ label: i.label, value: i.value, previous: compare ? i.previous : undefined }))} format={format} color={accentColor(accent)} limit={10} rankBadges />
      )}
    </ChartCard>
  );
}

/** KPI strip + generic breakdown/series charts for a report summary. A failed summary degrades to one quiet card (the table keeps working). */
export function ReportSummarySection({ summary, loading, error, accent, compare }: { summary: ReportSummary | undefined; loading: boolean; error: boolean; accent: ReportAccent; compare: boolean }) {
  if (error && !summary) {
    return <ChartCard title="Insights" error errorText="Insights unavailable right now. The report table below is unaffected." minHeight={80} />;
  }
  if (loading && !summary) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <KpiTile key={i} label="…" value={0} loading accent={accent} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard loading minHeight={260} />
          <ChartCard loading minHeight={260} />
        </div>
      </div>
    );
  }
  if (!summary) return null;

  const series = summary.series;
  const seriesFormat = series ? formatFromTitle(series.title) : 'number';
  const donuts = summary.breakdowns.filter((b) => b.kind === 'donut');
  const bars = summary.breakdowns.filter((b) => b.kind === 'bar');
  const hasPrev = compare && !!series?.points.some((p) => p.previous !== undefined);

  return (
    <div className="space-y-4 print:space-y-3">
      {summary.kpis.length ? <KpiStrip kpis={summary.kpis} accent={accent} compare={compare} /> : null}
      <div className="grid gap-4 print:hidden lg:grid-cols-3">
        {series ? (
          <ChartCard title={series.title} subtitle={hasPrev ? 'This period vs previous period' : undefined} empty={series.points.length === 0} className="lg:col-span-2">
            <TrendCompareChart
              data={series.points.map((p) => ({ label: shortDate(p.date), tip: p.date, value: p.value, previous: hasPrev ? p.previous : undefined }))}
              format={seriesFormat}
              color={accentColor(accent)}
              showPrevious={hasPrev}
              currentLabel="This period"
              previousLabel="Previous period"
              cumulativeToggle
            />
          </ChartCard>
        ) : null}
        {donuts.map((b) => (
          <BreakdownCard key={b.key} b={b} accent={accent} compare={compare} />
        ))}
        {bars.map((b) => (
          <BreakdownCard key={b.key} b={b} accent={accent} compare={compare} />
        ))}
      </div>
    </div>
  );
}
