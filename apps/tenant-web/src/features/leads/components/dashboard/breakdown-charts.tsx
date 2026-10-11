'use client';

import * as React from 'react';

import { DonutChart, HBarChart } from '@/features/reports/charts';
import { ChartCard } from '@/features/reports/components/ui';
import { lostReasonLabel, sourceColor, sourceLabel } from '../../lib/lead-meta';
import type { LeadAnalytics } from '../../types';
import { LeadAvatar } from '../shared/lead-ui';

interface P {
  data: LeadAnalytics | undefined;
  loading: boolean;
  error: boolean;
}

const pct = (r: number) => Math.round(r * 1000) / 10;

export function SourceDonutCard({ data, loading, error }: P) {
  const rows = (data?.bySource ?? []).filter((s) => s.leads > 0);
  return (
    <ChartCard title="Lead sources" subtitle="Leads created in range, by source" loading={loading} error={error} empty={!rows.length} emptyText="No leads in this period" minHeight={240}>
      <DonutChart data={rows.map((s) => ({ label: sourceLabel(s.source), value: s.leads, color: sourceColor(s.source) }))} centerLabel="Leads" size={170} side={false} />
    </ChartCard>
  );
}

export function SourceConversionCard({ data, loading, error }: P) {
  const rows = (data?.bySource ?? []).filter((s) => s.leads > 0);
  return (
    <ChartCard title="Conversion rate by source" subtitle="Share of each source's leads now converted" loading={loading} error={error} empty={!rows.length} emptyText="No leads in this period" minHeight={240}>
      <HBarChart data={rows.map((s) => ({ label: sourceLabel(s.source), value: pct(s.conversionRate), hint: `${s.converted} of ${s.leads}` }))} format="percent" color="var(--chart-3)" />
    </ChartCard>
  );
}

export function StaffBoardCard({ data, loading, error }: P) {
  const rows = [...(data?.byStaff ?? [])].sort((a, b) => b.converted - a.converted || b.leads - a.leads);
  return (
    <ChartCard title="Staff leaderboard" subtitle="Leads assigned, converted and rate" loading={loading} error={error} empty={!rows.length} emptyText="No assigned leads in this period" minHeight={240}>
      <ul className="space-y-3">
        {rows.slice(0, 8).map((r, i) => (
          <li key={r.userId ?? 'none'} className="flex items-center gap-3">
            <span className="w-4 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
            <LeadAvatar name={r.name} size={30} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="truncate font-bold">{r.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {r.converted}/{r.leads} <b className="text-foreground">{pct(r.conversionRate)}%</b>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${Math.max(r.conversionRate * 100, r.converted ? 3 : 0)}%`, backgroundColor: 'var(--success)' }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

export function LostReasonsCard({ data, loading, error }: P) {
  const rows = data?.lostReasons ?? [];
  return (
    <ChartCard title="Why leads are lost" subtitle="Lost in range, by reason" loading={loading} error={error} empty={!rows.length} emptyText="No lost leads in this period" minHeight={200}>
      <HBarChart data={rows.map((r) => ({ label: lostReasonLabel(r.reason), value: r.count }))} color="var(--destructive)" />
    </ChartCard>
  );
}

export function PlanInterestCard({ data, loading, error }: P) {
  const rows = (data?.byPlan ?? []).filter((p) => p.leads > 0);
  return (
    <ChartCard title="Interest by plan" subtitle="Leads created in range, by interested plan" loading={loading} error={error} empty={!rows.length} emptyText="No plan interest recorded" minHeight={200}>
      <HBarChart data={rows.map((p) => ({ label: p.name, value: p.leads, hint: `${p.converted} converted` }))} color="var(--chart-7)" />
    </ChartCard>
  );
}

export function AgeingCard({ data, loading, error }: P) {
  const rows = data?.ageing ?? [];
  return (
    <ChartCard title="Open lead ageing" subtitle="Open leads by days since created (all-time)" loading={loading} error={error} empty={!rows.some((r) => r.count)} emptyText="No open leads" minHeight={200}>
      <HBarChart data={rows.map((r) => ({ label: `${r.bucket} days`, value: r.count }))} sort={false} color="var(--chart-5)" />
    </ChartCard>
  );
}

export function BranchesCard({ data, loading, error }: P) {
  const rows = data?.topBranches ?? [];
  return (
    <ChartCard title="Branches" subtitle="Leads created in range, per branch" loading={loading} error={error} empty={!rows.length} emptyText="No branch data" minHeight={200}>
      <HBarChart data={rows.map((b) => ({ label: b.name, value: b.leads, hint: `${b.converted} converted (${pct(b.conversionRate)}%)` }))} color="var(--chart-2)" />
    </ChartCard>
  );
}
