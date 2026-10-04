'use client';

import * as React from 'react';
import { Printer } from 'lucide-react';

import { HeroButton } from '@/features/finance/components/payments/payments-hero';
import { isPaginated, useReportData, useReportSummary } from '../../hooks/use-reports';
import { useReportsControls } from '../../hooks/use-reports-controls';
import { categoryOf, getCatalogEntry } from '../../report-catalog';
import type { ReportFilters, TabularReportType } from '../../types';
import { ExportButtons } from '../export-buttons';
import { EMPTY_EXTRA_FILTERS, ReportFiltersBar, type ReportExtraFilters } from '../report-filters-bar';
import { Reveal, ReportsHero, type ReportsHeroStat } from '../ui';
import { ReportSummarySection } from './report-summary-section';
import { ReportTableCard } from './report-table-card';

type ReportRow = Record<string, unknown>;
const PAGE_SIZE = 20;

const clean = (o: Record<string, string | undefined>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v)) as ReportFilters;

/** Full viewer for one valid tabular report: hero, filters, insights (summary), table. */
export function ReportViewer({ type }: { type: TabularReportType }) {
  const entry = getCatalogEntry(type)!;
  const controls = useReportsControls('month');
  const [extra, setExtra] = React.useState<ReportExtraFilters>(EMPTY_EXTRA_FILTERS);
  const showDates = entry.showsDateRange;

  const baseParams = React.useMemo<ReportFilters>(
    () =>
      clean({
        dateFrom: showDates && controls.rangeReady ? controls.range.from : undefined,
        dateTo: showDates && controls.rangeReady ? controls.range.to : undefined,
        branchId: controls.branchId,
        memberStatus: type === 'membership' ? extra.memberStatus : undefined,
        planId: type === 'membership' ? extra.planId : undefined,
        paymentStatus: type === 'payments' ? extra.paymentStatus : undefined,
      }),
    [showDates, controls.rangeReady, controls.range.from, controls.range.to, controls.branchId, extra, type],
  );

  // Page resets whenever any filter changes (page is tied to the filter signature instead of an effect).
  const filterKey = JSON.stringify(baseParams);
  const [pageState, setPageState] = React.useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ key: filterKey, page: p });

  const queryFilters = React.useMemo<ReportFilters>(() => ({ ...baseParams, page, limit: PAGE_SIZE }), [baseParams, page]);
  const report = useReportData<ReportRow>(type, queryFilters);
  const summary = useReportSummary(type, baseParams, !showDates || controls.rangeReady);

  const data = report.data;
  const paginated = isPaginated(data) ? data : null;
  const rows: ReportRow[] = paginated ? paginated.items : Array.isArray(data) ? data : [];
  const total = paginated ? paginated.total : data ? rows.length : null;

  const summaryStats: ReportsHeroStat[] = (summary.data?.kpis ?? [])
    .filter((k) => k.format !== 'text' && !Number.isNaN(Number(k.value)))
    .slice(0, 3)
    .map((k) => ({ label: k.label, value: Number(k.value), format: k.format }));
  const stats: ReportsHeroStat[] = summaryStats.length ? summaryStats : total !== null ? [{ label: 'Results', value: total }] : [];
  const statsLoading = stats.length === 0 && (report.isPending || summary.isPending);

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">{entry.title}</h1>
        <p className="text-sm text-muted-foreground">
          {entry.description}
          {showDates && controls.rangeReady ? ` ${controls.range.from} – ${controls.range.to}` : ''}
        </p>
      </div>

      <div className="print:hidden">
        <ReportsHero
          eyebrow={categoryOf(entry.category).label}
          title={entry.title}
          subtitle={entry.description}
          accent={entry.accent}
          icon={entry.icon}
          backHref="/reports"
          backLabel="Back to Reports Center"
          stats={stats.length || statsLoading ? (stats.length ? stats : [{ label: 'Loading', value: 0 }]) : undefined}
          statsLoading={statsLoading}
          actions={
            <>
              <HeroButton onClick={() => window.print()}>
                <Printer className="size-4" /> Print
              </HeroButton>
              <ExportButtons reportType={type} filters={baseParams} />
            </>
          }
        />
      </div>

      <Reveal>
        <ReportFiltersBar type={type} accent={entry.accent} controls={controls} showDateRange={showDates} extra={extra} onExtra={(patch) => setExtra((prev) => ({ ...prev, ...patch }))} />
      </Reveal>

      <ReportSummarySection summary={summary.data} loading={summary.isPending && summary.fetchStatus !== 'idle'} error={summary.isError} accent={entry.accent} compare={showDates && controls.compare} />

      <Reveal>
        <ReportTableCard
          type={type}
          rows={rows}
          loading={report.isPending}
          error={report.error}
          onRetry={() => void report.refetch()}
          accent={entry.accent}
          page={page}
          onPage={setPage}
          pageSize={PAGE_SIZE}
          total={total}
          totalPages={paginated?.totalPages ?? 1}
        />
      </Reveal>
    </div>
  );
}
