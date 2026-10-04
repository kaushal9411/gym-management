'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, LayoutGrid } from 'lucide-react';

import { PeriodBar } from '@/features/finance/components/payments/period-bar';
import { useBranchComparison } from '../../hooks/use-reports';
import { useReportsControls } from '../../hooks/use-reports-controls';
import { useMotionSafe } from '../../lib/motion';
import { ExportButtons } from '../export-buttons';
import { ChartCard, DeltaBadge, ReportsHero, StatPill, type ReportsHeroStat } from '../ui';
import { ANALYTICS_VIEWS, VIEW_BY_SLUG, VIEW_COPY, isViewSlug, type AnalyticsView, type ViewSlug } from './analytics-config';
import { BranchFocus, BranchOverviewChart } from './branch-panel';
import { computeStats } from './series-stats';
import { previousRange } from './use-analytics-series';
import { useAnalyticsData, type SeriesResult } from './use-analytics-data';
import { ViewChart } from './view-chart';
import { ViewStatsRow } from './view-stats-row';

const SERIES_VIEWS = ANALYTICS_VIEWS.filter((v) => v.slug !== 'branch-comparison');

function DeepDiveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={`Open ${label}`} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold text-foreground/80 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      Deep dive <ArrowUpRight className="size-3.5" aria-hidden />
    </button>
  );
}

/** `/analytics`: hero tabs (Overview + 7 views), period/compare bar, overview grid or single-view focus with stats. */
export function AnalyticsContent() {
  const m = useMotionSafe();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const param = searchParams.get('view');
  const view: ViewSlug | null = isViewSlug(param) ? param : null;

  const controls = useReportsControls('month');
  const { range, rangeReady, compare, branchId } = controls;
  const branch = branchId || undefined;
  const prevRange = React.useMemo(() => previousRange(range.from || '1970-01-01', range.to || '1970-01-01'), [range.from, range.to]);

  const data = useAnalyticsData({ from: range.from, to: range.to, branchId: branch, ready: rangeReady, compare, view });
  const branchCur = useBranchComparison(branch, range.from, range.to);
  const branchPrev = useBranchComparison(branch, prevRange.from, prevRange.to);

  const setView = (next: string) => {
    const qs = next === 'overview' ? '' : `?view=${next}`;
    router.replace(`${pathname}${qs}`, { scroll: false });
  };

  const days = rangeReady ? Math.round((Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000) + 1 : 0;
  const statsOf = (v: AnalyticsView, r: SeriesResult) => computeStats(r.rows, v.kind);
  const focusView = view ? VIEW_BY_SLUG.get(view)! : null;
  const focusSeries = focusView && focusView.slug !== 'branch-comparison' ? data[focusView.slug] : null;
  const focusStats = focusView && focusSeries ? statsOf(focusView, focusSeries) : null;

  // Hero numbers: overview headlines vs the focused view's headline figures.
  let heroStats: ReportsHeroStat[] = [];
  if (focusView && focusStats && focusSeries) {
    const snapshot = focusView.kind === 'snapshot';
    heroStats = [
      { label: snapshot ? 'Latest' : 'Total', value: snapshot ? focusStats.latest : focusStats.total, format: focusView.format },
      { label: 'Daily average', value: focusStats.average, format: focusView.format },
      { label: 'Peak day', value: focusStats.peak, format: focusView.format },
    ];
  } else if (!focusView) {
    heroStats = [
      { label: 'Income', value: statsOf(SERIES_VIEWS[0]!, data['revenue-trends']).total, format: 'money' },
      { label: 'Check-ins', value: statsOf(SERIES_VIEWS[1]!, data['attendance-trends']).total },
      { label: 'New members', value: statsOf(SERIES_VIEWS[3]!, data['new-member-growth']).total },
    ];
  }
  const heroLoading = focusSeries ? focusSeries.isPending : data['revenue-trends'].isPending && data['attendance-trends'].isPending;

  const exportFilters = { dateFrom: rangeReady ? range.from : undefined, dateTo: rangeReady ? range.to : undefined, branchId: branch };
  const branchRows = branchCur.data ?? [];
  const branchPrevRows = compare ? branchPrev.data : undefined;

  const overviewCard = (v: AnalyticsView) => {
    const copy = VIEW_COPY[v.slug];
    if (v.slug === 'branch-comparison') {
      return (
        <ChartCard key={v.slug} className="lg:col-span-2" title={copy.title} subtitle={copy.subtitle} loading={branchCur.isPending} error={branchCur.isError} empty={branchRows.length === 0} actions={<DeepDiveButton label={copy.title} onClick={() => setView(v.slug)} />}>
          <BranchOverviewChart rows={branchRows} prev={branchPrevRows} compare={compare} />
        </ChartCard>
      );
    }
    const r = data[v.slug as keyof typeof data];
    const s = statsOf(v, r);
    const basis = v.kind === 'snapshot' ? s.latest : s.total;
    const prevBasis = v.kind === 'snapshot' ? s.prevLatest : s.prevTotal;
    return (
      <ChartCard
        key={v.slug}
        title={copy.title}
        subtitle={copy.subtitle}
        loading={r.isPending}
        error={r.isError}
        actions={
          <span className="flex items-center gap-2">
            {compare ? <DeltaBadge value={basis} previous={prevBasis} size="sm" /> : null}
            <DeepDiveButton label={copy.title} onClick={() => setView(v.slug)} />
          </span>
        }
      >
        <ViewChart view={v} rows={r.rows} compare={compare} height={230} />
      </ChartCard>
    );
  };

  return (
    <div className="space-y-5">
      <ReportsHero
        eyebrow="Analytics"
        title={focusView ? VIEW_COPY[focusView.slug].title : 'Analytics'}
        subtitle={focusView ? VIEW_COPY[focusView.slug].subtitle : 'Trends and comparisons across revenue, attendance, members and branches.'}
        accent={focusView ? focusView.entry.accent : 'analytics'}
        icon={focusView ? focusView.entry.icon : LayoutGrid}
        stats={heroStats.length ? heroStats : undefined}
        statsLoading={heroLoading}
        actions={focusView ? <ExportButtons reportType={`analytics-${focusView.slug}`} filters={exportFilters} /> : undefined}
        tabs={[{ value: 'overview', label: 'Overview', icon: LayoutGrid }, ...ANALYTICS_VIEWS.map((v) => ({ value: v.slug, label: VIEW_COPY[v.slug].title, icon: v.entry.icon }))]}
        activeTab={view ?? 'overview'}
        onTabChange={setView}
      />

      <PeriodBar
        period={controls.period}
        onPeriod={controls.changePeriod}
        customFrom={controls.custom.from}
        customTo={controls.custom.to}
        onCustom={controls.setDates}
        branchId={controls.branchId}
        onBranch={controls.changeBranch}
        compare={compare}
        onCompare={controls.setCompare}
      />
      {compare && rangeReady ? (
        <p className="-mt-2 flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
          <StatPill label="Previous period" value={`${prevRange.from} – ${prevRange.to}`} accent="analytics" />
          <span>Dashed lines show the previous period of equal length.</span>
        </p>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={view ?? 'overview'} variants={m.pageTransition} initial="hidden" animate="show" exit="exit" className="space-y-4">
          {!rangeReady ? (
            <ChartCard empty emptyText="Pick a valid date range (start on or before end)." minHeight={160} />
          ) : focusView ? (
            focusView.slug === 'branch-comparison' ? (
              <ChartCard title={VIEW_COPY[focusView.slug].title} subtitle={`${range.from} – ${range.to}`} loading={branchCur.isPending} error={branchCur.isError} empty={branchRows.length === 0} minHeight={320}>
                <BranchFocus rows={branchRows} prev={branchPrevRows} compare={compare} />
              </ChartCard>
            ) : focusStats && focusSeries ? (
              <>
                <ViewStatsRow view={focusView} stats={focusStats} days={days} compare={compare} loading={focusSeries.isPending} />
                <ChartCard title={VIEW_COPY[focusView.slug].title} subtitle={`${range.from} – ${range.to}`} loading={focusSeries.isPending} error={focusSeries.isError} minHeight={380}>
                  <ViewChart view={focusView} rows={focusSeries.rows} compare={compare} height={380} />
                </ChartCard>
              </>
            ) : null
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{ANALYTICS_VIEWS.map(overviewCard)}</div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
