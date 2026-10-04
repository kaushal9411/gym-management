'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { OVERVIEW_QUERY_KEY, useDashboardOverview, useDashboardStats } from '../hooks/use-dashboard';
import type { DashboardOverview, OverviewRange } from '../types';
import { AtRiskTenants, FailedPayments, TrialsEndingSoon } from './action-panels';
import { CountryBars, RevenueTrend, SignupsVsChurn, StatusAndPlans, SupportCard, TrialFunnel } from './charts';
import { CommandBar, type ConsoleIntent, type TenantRef } from './command-console';
import { pushRecentTenant } from './recent-tenants';
import { TenantControlCard } from './tenant-control-card';
import { buildOverviewCsv, downloadCsv } from './export-csv';
import { fmtInt, fmtMoneyCompact, fmtPct, timeAgo } from './format';
import { KpiCard, type KpiCardProps } from './kpi-card';
import { ActivityTimeline, TopTenants } from './lists';
import { overviewFromStats } from './overview-fallback';
import { SystemHealth } from './system-health';
import { Segmented, EmptyNote } from './ui';
import { useNow } from './use-now';

const RANGES: Array<{ value: OverviewRange; label: string; long: string; n: string }> = [
  { value: '7d', label: '7D', long: '7 days', n: '7' },
  { value: '30d', label: '30D', long: '30 days', n: '30' },
  { value: '90d', label: '90D', long: '90 days', n: '90' },
  { value: '12m', label: '12M', long: '12 months', n: '12' },
];

function buildKpis(o: DashboardOverview, rangeLong: string): Array<Omit<KpiCardProps, 'index'>> {
  const k = o.kpis;
  const signups = o.signupsDaily.length > 1 ? o.signupsDaily.map((d) => d.count) : undefined;
  const revenue = o.revenueDaily.length > 1 ? o.revenueDaily.map((d) => Number(d.amount)) : undefined;
  const mrrSeries = o.mrrDaily && o.mrrDaily.length > 1 ? o.mrrDaily.map((d) => Number(d.mrr)) : revenue;
  const num = (v: string | null | undefined) => (v === null || v === undefined ? null : Number(v));
  const trialsWeek = o.trialsExpiring.length;
  const list: Array<Omit<KpiCardProps, 'index'> | null | undefined> = [
    k.mrr && { label: 'MRR', value: Number(k.mrr.value), previous: num(k.mrr.previous), format: fmtMoneyCompact, color: 'var(--chart-1)', series: mrrSeries, fallbackCaption: 'run-rate' },
    k.arr && { label: 'ARR', value: Number(k.arr.value), previous: num(k.arr.previous), format: fmtMoneyCompact, color: 'var(--chart-2)', fallbackCaption: 'run-rate' },
    k.activeTenants && { label: 'Active tenants', value: k.activeTenants.value, previous: k.activeTenants.previous, format: fmtInt, color: 'var(--chart-6)', series: signups, caption: 'vs prev', fallbackCaption: k.newTenants ? `+${fmtInt(k.newTenants.value)} new` : undefined },
    k.trialTenants && { label: 'In trial', value: k.trialTenants.value, previous: k.trialTenants.previous, format: fmtInt, color: 'var(--chart-4)', fallbackCaption: o.trialsExpiring.length || k.trialTenants.value ? `${fmtInt(trialsWeek)} end this week` : undefined },
    k.churned && { label: `Churned (${rangeLong})`, value: k.churned.value, previous: k.churned.previous, invert: true, format: fmtInt, color: 'var(--chart-5)', fallbackCaption: 'this period' },
    k.trialConversion && { label: 'Trial → paid', value: k.trialConversion.value, previous: k.trialConversion.previous, deltaMode: 'abs', absSuffix: ' pts', format: fmtPct, color: 'var(--chart-3)', caption: 'vs prev', fallbackCaption: `last ${rangeLong}` },
  ];
  return list.filter((x): x is Omit<KpiCardProps, 'index'> => !!x);
}

function Skeletons() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading dashboard">
      <Skeleton className="h-16 rounded-[14px]" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[120px] rounded-[14px]" />)}</div>
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-12"><Skeleton className="h-72 rounded-[14px] xl:col-span-8" /><Skeleton className="h-72 rounded-[14px] xl:col-span-4" /></div>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-60 rounded-[14px]" />)}</div>
    </div>
  );
}

export function DashboardPage() {
  const qc = useQueryClient();
  const now = useNow(30_000);
  const canRead = useHasPermission('tenants:read');
  const canManage = useHasPermission('tenants:manage');
  const [range, setRange] = useState<OverviewRange>('30d');
  const [no12m, setNo12m] = useState(false);
  const [target, setTarget] = useState<TenantRef | null>(null);
  const [focus, setFocus] = useState<{ intent: ConsoleIntent; nonce: number } | null>(null);

  const ov = useDashboardOverview(range);
  // The 12m range needs a newer API build; when it is rejected, hide the option and fall back to 30d.
  useEffect(() => {
    if (range === '12m' && ov.isError) { setNo12m(true); setRange('30d'); }
  }, [range, ov.isError]);

  const stats = useDashboardStats({ enabled: ov.isError && range !== '12m' });
  const limited = ov.isError && !ov.data && !!stats.data;
  const data = useMemo(() => ov.data ?? (ov.isError && stats.data ? overviewFromStats(stats.data) : null), [ov.data, ov.isError, stats.data]);

  const meta = RANGES.find((r) => r.value === range)!;
  // Selecting a tenant (search, row click, recent chip) is the only thing that shows the inline control card.
  const choose = (tenant: TenantRef | null) => {
    setFocus(null);
    setTarget(tenant);
    if (tenant) pushRecentTenant({ id: tenant.id, slug: tenant.slug, name: tenant.name });
  };
  const select = canRead ? (tenant: TenantRef, intent?: ConsoleIntent) => { choose(tenant); if (intent) setFocus({ intent, nonce: Date.now() }); } : undefined;

  const kpis = data ? buildKpis(data, meta.long) : [];
  const updated = ov.dataUpdatedAt && now ? timeAgo(ov.dataUpdatedAt, now) : null;
  const funnel = data?.trialFunnel ?? null;
  const showRevenue = !!data && (data.revenueDaily.length > 1 || (data.mrrDaily?.length ?? 0) > 1);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Platform overview</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Last {meta.long} compared with the previous {meta.n}{updated ? ` · updated ${updated}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Segmented
            label="Period"
            value={range}
            onChange={setRange}
            options={RANGES.filter((r) => r.value !== '12m' || !no12m).map((r) => ({ value: r.value, label: r.label }))}
          />
          <Button variant="outline" size="icon" aria-label="Refresh data" title="Refresh" onClick={() => void qc.invalidateQueries({ queryKey: [...OVERVIEW_QUERY_KEY] })}>
            <RefreshCw className={`size-4 ${ov.isFetching ? 'animate-spin' : ''}`} aria-hidden />
          </Button>
          <Button variant="outline" disabled={!data} onClick={() => data && downloadCsv(`fitcloud-overview-${range}-${new Date().toISOString().slice(0, 10)}.csv`, buildOverviewCsv(data, range))}>
            <Download className="size-4" aria-hidden />Export report
          </Button>
        </div>
      </div>

      {limited ? <p role="status" className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">Limited data — the overview endpoint is unavailable, showing the basic stats summary.</p> : null}
      {canRead ? <CommandBar target={target} onTarget={choose} onQuick={(intent) => setFocus({ intent, nonce: Date.now() })} /> : null}
      {canRead && target ? <TenantControlCard key={target.id} tenant={target} focus={focus} onClose={() => choose(null)} /> : null}

      {!data ? (
        ov.isError ? (
          <EmptyNote>Unable to load the platform overview. <button type="button" className="font-semibold text-primary underline" onClick={() => void ov.refetch()}>Retry</button></EmptyNote>
        ) : <Skeletons />
      ) : (
        <div className={`space-y-4 transition-opacity ${ov.isFetching && ov.isPlaceholderData ? 'opacity-70' : ''}`}>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
            {kpis.map((k, i) => <KpiCard key={k.label} {...k} index={i} />)}
          </div>

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-12">
            {showRevenue ? <RevenueTrend data={data} index={1} /> : null}
            <StatusAndPlans data={data} index={2} />
            <SignupsVsChurn data={data} index={3} className={funnel ? 'xl:col-span-6' : 'md:col-span-2 xl:col-span-6'} />
            {funnel ? <TrialFunnel funnel={funnel} rangeLabel={`last ${meta.long}`} index={4} /> : data.supportTickets ? <div className="md:col-span-2 xl:col-span-6"><SupportCard t={data.supportTickets} index={4} /></div> : null}
            <TrialsEndingSoon rows={data.trialsExpiring} canManage={canManage} onSelect={select} index={5} />
            {data.kpis.failedPayments || data.failedPaymentsList ? <FailedPayments data={data} index={6} /> : null}
            <AtRiskTenants data={data} onSelect={select} index={7} />
            <TopTenants rows={data.topTenants} onSelect={select} index={8} />
            <div className="grid content-start gap-3.5 md:col-span-2 xl:col-span-5">
              {data.countries.length ? <CountryBars rows={data.countries} index={9} /> : null}
              {funnel && data.supportTickets ? <SupportCard t={data.supportTickets} index={10} /> : null}
            </div>
            <ActivityTimeline rows={data.activity} now={now} index={11} />
            {data.health ? <SystemHealth health={data.health} stamp={data.generatedAt} index={12} /> : null}
          </div>
        </div>
      )}

    </div>
  );
}
