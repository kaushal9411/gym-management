'use client';

import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import { Bar as RBar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { shortDate, fmtInt } from '@/features/dashboard/components/format';
import { Avatar, ChartTooltip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { money } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { AXIS, CHART, GRID, moneyCompact, moneyWhole, num, type TabData } from './common';

const STATUS_COLOR: Record<string, string> = {
  SUCCEEDED: 'var(--chart-6)', PENDING: 'var(--chart-4)', FAILED: 'var(--chart-5)', REFUNDED: 'var(--chart-7)', PARTIALLY_REFUNDED: 'var(--chart-8)',
};
const pretty = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export function OverviewTab({ data, compare }: TabData) {
  const reduce = !!useReducedMotion();
  const cur = data.currency;
  const k = data.kpis;
  const fm = (v: number) => money(v, cur);
  const fw = (v: number) => moneyWhole(v, cur);
  const prev = (v: string | number | null | undefined) => (compare && v !== null && v !== undefined ? num(v) : null);
  const collectedSeries = data.daily.map((d) => num(d.collected));
  const hasDaily = data.daily.some((d) => num(d.collected) > 0 || d.failed > 0);
  const rows = data.daily.map((d) => ({ label: shortDate(d.date), cur: num(d.collected), prev: d.previousCollected === null ? null : num(d.previousCollected), failed: d.failed }));
  const hasPrev = compare && rows.some((r) => r.prev);
  const monthly = data.monthly.map((m) => ({ label: m.month.slice(2), full: m.month, amount: num(m.collected) }));
  const hasMonthly = monthly.some((m) => m.amount > 0);
  const statusTotal = data.statusMix.reduce((a, s) => a + s.count, 0);
  const segs = data.statusMix.filter((s) => s.count > 0);
  const topMax = Math.max(1, ...data.topTenants.map((t) => num(t.collected)));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard index={0} color="#0f766e" label="MRR" value={num(k.mrr.value)} format={fw} caption="active paid, run-rate" />
        <KpiCard index={1} color="#2563eb" label="ARR" value={num(k.arr.value)} format={fw} caption="MRR x 12" />
        <KpiCard index={2} color="#7c3aed" label="ARPA" value={num(k.arpa?.value)} format={fw} caption="per active account" />
        <KpiCard index={3} color="#16a34a" label="Collected" value={num(k.collected.value)} format={fw} previous={prev(k.collected.previous)} caption="vs previous" fallbackCaption="in this range" series={collectedSeries} />
        <KpiCard index={4} color="#dc2626" label="Failed payments" value={k.failed.count} format={fmtInt} previous={prev(k.failed.previousCount)} invert caption="vs previous" fallbackCaption={`${money(k.failed.amount, cur)} at stake`} />
        <KpiCard index={5} color="#0e7490" label="Collection rate" value={num(k.collectionRate.value) * 100} format={(v) => `${Math.round(v * 10) / 10}%`} previous={prev(k.collectionRate.previous === null ? null : num(k.collectionRate.previous) * 100)} deltaMode="abs" absSuffix=" pts" caption="vs previous" fallbackCaption="succeeded of attempted" />
        <KpiCard index={6} color="#d97706" label="Outstanding invoices" value={num(k.outstanding.value)} format={fw} caption={`${fmtInt(k.outstanding.invoiceCount)} open ${k.outstanding.invoiceCount === 1 ? 'invoice' : 'invoices'}`} />
        <KpiCard index={7} color="#db2777" label="Pipeline MRR" value={num(k.pipelineMrr.value)} format={fw} caption="if all trials convert" />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
        <Panel title="Collected revenue" hint="per day, with failed payments" index={1} className="md:col-span-2 xl:col-span-8">
          {!hasDaily ? <EmptyNote>No payments in this range.</EmptyNote> : (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded bg-[var(--chart-1)]" aria-hidden />Collected<b className="ml-1 text-foreground tabular-nums">{money(k.collected.value, cur)}</b></span>
                {hasPrev ? <span className="flex items-center gap-1.5"><i className="w-4 border-t-2 border-dashed border-slate-400" aria-hidden />Previous period</span> : null}
                <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-[var(--chart-5)]" aria-hidden />Failed payments (count)</span>
              </div>
              <div className="h-[250px] w-full" role="img" aria-label="Daily collected revenue with failed payments">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={32} />
                    <YAxis yAxisId="m" tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => moneyCompact(v, cur)} />
                    <YAxis yAxisId="c" orientation="right" hide domain={[0, (max: number) => Math.max(4, max * 4)]} />
                    <Tooltip content={<ChartTooltip fmt={fm} names={{ cur: 'Collected', prev: 'Previous', failed: 'Failed' }} />} />
                    <RBar yAxisId="c" dataKey="failed" fill="var(--chart-5)" radius={[3, 3, 0, 0]} maxBarSize={8} isAnimationActive={!reduce} animationDuration={250} />
                    {hasPrev ? <Line yAxisId="m" type="monotone" dataKey="prev" stroke="var(--chart-7)" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={!reduce} animationDuration={400} /> : null}
                    <Line yAxisId="m" type="monotone" dataKey="cur" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} activeDot={{ r: 4.5, strokeWidth: 2.5, fill: 'var(--card)' }} isAnimationActive={!reduce} animationDuration={400} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Panel>

        <Panel title="Payment status" hint={`${fmtInt(statusTotal)} attempts`} index={2} className="xl:col-span-4">
          {statusTotal === 0 ? <EmptyNote>No payments in this range.</EmptyNote> : (
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="relative size-[130px] shrink-0" role="img" aria-label={`Payment status: ${segs.map((s) => `${pretty(s.status)} ${s.count}`).join(', ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={segs} dataKey="count" nameKey="status" innerRadius={44} outerRadius={60} paddingAngle={segs.length > 1 ? 2 : 0} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={!reduce} animationDuration={400}>
                      {segs.map((s) => <Cell key={s.status} fill={STATUS_COLOR[s.status] ?? 'var(--chart-7)'} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <span className="pointer-events-none absolute inset-0 grid place-items-center text-lg font-semibold tabular-nums">{fmtInt(statusTotal)}</span>
              </div>
              <ul className="grid min-w-0 flex-1 basis-[170px] gap-1.5 text-[12.5px]">
                {data.statusMix.map((s) => (
                  <li key={s.status} className="flex items-center gap-2">
                    <i className="size-[9px] shrink-0 rounded-[3px]" style={{ background: STATUS_COLOR[s.status] ?? 'var(--chart-7)' }} aria-hidden />
                    <span className="truncate">{pretty(s.status)}</span>
                    <b className="ml-auto tabular-nums">{fmtInt(s.count)}</b>
                    <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">{moneyCompact(num(s.amount), cur)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel title="Collected by month" hint="last 12 months" index={3} className="md:col-span-2 xl:col-span-8">
          {!hasMonthly ? <EmptyNote>No payments in the last 12 months.</EmptyNote> : (
            <div className="h-[200px] w-full" role="img" aria-label="Collected revenue by month">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => moneyCompact(v, cur)} />
                  <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ChartTooltip fmt={fm} names={{ amount: 'Collected' }} />} />
                  <RBar dataKey="amount" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={!reduce} animationDuration={250} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Top tenants by revenue" hint="this range" index={4} className="xl:col-span-4">
          {data.topTenants.length === 0 ? <EmptyNote>No payments in this range.</EmptyNote> : (
            <ol className="space-y-3">
              {data.topTenants.slice(0, 5).map((t, i) => (
                <li key={t.tenantId} className="flex items-center gap-2.5">
                  <Avatar name={t.name} seed={t.tenantId} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <Link href={`/tenants/${t.tenantId}`} className="truncate text-[13px] font-semibold outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">{t.name}</Link>
                      <b className="ml-auto shrink-0 text-[13px] tabular-nums">{money(t.collected, cur)}</b>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(num(t.collected) / topMax) * 100}%`, background: CHART[i % CHART.length] }} /></div>
                      <span className="text-[11px] text-muted-foreground">{t.plan ?? 'No plan'}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
