'use client';

import { AlertCircle, CheckCircle2, CircleDot, Hourglass, Inbox } from 'lucide-react';
import * as React from 'react';

import { DonutChart, GroupedBarChart, TrendCompareChart } from '@/features/reports/charts';
import { ChartCard, KpiTile, StaggerGroup } from '@/features/reports/components/ui';
import { shortDate } from '@/features/reports/lib/format';
import { PRIORITY_META, PRIORITY_ORDER, STATUS_META, STATUS_ORDER, SUPPORT_COLOR } from '../lib/ticket-meta';
import type { TicketStats } from '../types';

/** Analytics section. Every number comes from `GET /support/tickets/stats`. */
export function SupportInsights({ stats, loading, compare, previousLabel }: { stats: TicketStats | undefined; loading: boolean; compare: boolean; previousLabel: string }) {
  const k = stats?.kpis;
  const sparkline = React.useMemo(() => (stats?.daily ?? []).map((d) => d.created), [stats]);
  const trend = React.useMemo(
    () =>
      (stats?.daily ?? []).map((d) => ({
        label: shortDate(d.date),
        value: d.created,
        previous: compare ? d.previousCreated : undefined,
        tip: shortDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' }),
      })),
    [stats, compare],
  );
  const statusData = React.useMemo(
    () => STATUS_ORDER.map((s) => ({ label: STATUS_META[s].label, value: stats?.byStatus.find((b) => b.status === s)?.count ?? 0, color: STATUS_META[s].color })),
    [stats],
  );
  const priorityData = React.useMemo(
    () =>
      PRIORITY_ORDER.map((p) => {
        const row = stats?.byPriority.find((b) => b.priority === p);
        return { label: PRIORITY_META[p].label, value: row?.count ?? 0, previous: compare ? (row?.previousCount ?? 0) : undefined };
      }),
    [stats, compare],
  );
  const oldest = k?.oldestOpenDays?.value ?? null;

  return (
    <div className="space-y-4">
      <StaggerGroup className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiTile label="Created" value={k?.created.value ?? 0} previous={compare ? k?.created.previous : null} icon={Inbox} accent="operations" sparkline={sparkline} hint="this period" loading={loading} />
        <KpiTile label="Unresolved" value={k?.unresolved.value ?? 0} icon={AlertCircle} accent="staff" hint="open + in progress" loading={loading} />
        <KpiTile label="Open" value={k?.open.value ?? 0} icon={CircleDot} accent="attendance" hint="waiting for us" loading={loading} />
        <KpiTile label="Resolved" value={k?.resolved.value ?? 0} icon={CheckCircle2} accent="finance" hint="fixed, awaiting close" loading={loading} />
        <KpiTile
          label="Oldest open ticket"
          value={oldest ?? 0}
          icon={Hourglass}
          accent={oldest !== null && oldest >= 7 ? 'attendance' : 'members'}
          hint={oldest === null ? 'No open tickets' : oldest === 1 ? 'day waiting' : 'days waiting'}
          loading={loading}
        />
      </StaggerGroup>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="Tickets created" subtitle={compare ? `Per day vs ${previousLabel.toLowerCase()}` : 'Per day'} loading={loading} empty={!trend.length} emptyText="No tickets raised in this period">
          <TrendCompareChart data={trend} variant="area" color={SUPPORT_COLOR} currentLabel="Created" previousLabel={previousLabel} showPrevious={compare} height={260} />
        </ChartCard>
        <ChartCard title="By status" subtitle="All tickets right now" loading={loading} empty={statusData.every((d) => d.value === 0)} emptyText="No tickets yet">
          <DonutChart data={statusData} centerLabel="Total" centerValue={String(statusData.reduce((a, d) => a + d.value, 0))} />
        </ChartCard>
      </div>

      <ChartCard title="By priority" subtitle={compare ? `Tickets created by priority vs ${previousLabel.toLowerCase()}` : 'Tickets created by priority'} loading={loading} empty={priorityData.every((d) => d.value === 0 && !d.previous)} emptyText="No tickets raised in this period">
        <GroupedBarChart data={priorityData} color={SUPPORT_COLOR} currentLabel="This period" previousLabel={previousLabel} height={230} />
      </ChartCard>
    </div>
  );
}
