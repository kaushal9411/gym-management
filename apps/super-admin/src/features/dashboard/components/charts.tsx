'use client';

import { useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Area, AreaChart, Bar as RBar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { DashboardOverview } from '../types';
import { fmtCompact, fmtInt, fmtMoney, fmtMoneyCompact, shortDate } from './format';
import { Bar, ChartTooltip, Chip, EmptyNote, Panel, Segmented } from './ui';

const AXIS = { fontSize: 11, fill: 'var(--muted-foreground)' } as const;
const GRID = 'var(--border)';
const PLAN_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-7)', 'var(--chart-8)', 'var(--chart-4)'];

type RevMode = 'mrr' | 'collected';

/** Recurring revenue (MRR) when the API supplies `mrrDaily`; otherwise collected revenue. Toggle only lists series that exist. */
export function RevenueTrend({ data, index }: { data: DashboardOverview; index: number }) {
  const reduce = !!useReducedMotion();
  const hasMrr = !!data.mrrDaily && data.mrrDaily.length > 1;
  const hasCollected = data.revenueDaily.length > 1;
  const [pick, setPick] = useState<RevMode>('mrr');
  const mode: RevMode = pick === 'mrr' && hasMrr ? 'mrr' : hasCollected && (pick === 'collected' || !hasMrr) ? 'collected' : 'mrr';

  const rows = useMemo(() => {
    if (mode === 'mrr' && hasMrr) {
      const prev = data.mrrDailyPrevious ?? [];
      return data.mrrDaily!.map((d, i) => ({ label: shortDate(d.date), cur: Number(d.mrr), prev: prev[i] ? Number(prev[i]!.mrr) : null }));
    }
    return data.revenueDaily.map((d) => ({ label: shortDate(d.date), cur: Number(d.amount), prev: Number(d.previousAmount) }));
  }, [data, mode, hasMrr]);

  const hasPrev = rows.some((r) => r.prev !== null && r.prev !== 0);
  const title = mode === 'mrr' && hasMrr ? 'Recurring revenue' : 'Collected revenue';
  const modes = [hasMrr && { value: 'mrr' as const, label: 'MRR' }, hasCollected && { value: 'collected' as const, label: 'Collected' }].filter((x): x is { value: RevMode; label: string } => !!x);
  const total = rows.reduce((a, r) => a + r.cur, 0);
  const arpa = data.kpis.arpa ? Number(data.kpis.arpa.value) : null;

  return (
    <Panel
      title={title}
      hint={mode === 'mrr' && hasMrr ? 'MRR, this period vs previous' : 'Payments collected per day, this period vs previous'}
      index={index}
      className="md:col-span-2 xl:col-span-8"
      right={modes.length > 1 ? <Segmented label="Revenue series" value={mode} onChange={setPick} options={modes} /> : null}
    >
      {rows.length < 2 ? <EmptyNote>No revenue recorded in this period.</EmptyNote> : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded bg-[var(--chart-1)]" aria-hidden />This period total<b className="ml-1 text-foreground tabular-nums">{fmtMoneyCompact(total)}</b></span>
            {hasPrev ? <span className="flex items-center gap-1.5"><i className="w-4 border-t-2 border-dashed border-slate-400" aria-hidden />Previous period</span> : null}
            {arpa !== null ? <span className="ml-auto">ARPA <b className="text-foreground tabular-nums">{fmtMoneyCompact(arpa)}</b></span> : null}
          </div>
          <div className="h-[230px] w-full" role="img" aria-label={`${title} trend chart`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={32} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => fmtMoneyCompact(v)} />
                <Tooltip content={<ChartTooltip fmt={fmtMoney} names={{ cur: 'This period', prev: 'Previous' }} />} />
                {hasPrev ? <Area type="monotone" dataKey="prev" stroke="var(--chart-7)" strokeWidth={2} strokeDasharray="5 5" fill="none" dot={false} isAnimationActive={!reduce} animationDuration={500} /> : null}
                <Area type="monotone" dataKey="cur" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#rev-fill)" dot={false} activeDot={{ r: 4.5, strokeWidth: 2.5, fill: 'var(--card)' }} isAnimationActive={!reduce} animationDuration={500} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Panel>
  );
}

/** Tenant status donut + plan-mix stacked bar. */
export function StatusAndPlans({ data, index }: { data: DashboardOverview; index: number }) {
  const reduce = !!useReducedMotion();
  const k = data.kpis;
  const total = k.tenantsTotal?.value;
  const segs = [
    { name: 'Active', value: k.activeTenants?.value ?? 0, color: 'var(--chart-6)' },
    { name: 'Trial', value: k.trialTenants?.value ?? 0, color: 'var(--chart-4)' },
    { name: 'Suspended', value: k.suspendedTenants?.value ?? 0, color: 'var(--chart-5)' },
    { name: 'Expired / cancelled', value: k.expiredTenants?.value ?? 0, color: 'var(--chart-7)' },
  ].filter((s) => s.value > 0);
  const sum = segs.reduce((a, s) => a + s.value, 0);
  const byMrr = data.planMix.length > 0 && data.planMix.every((p) => p.mrr !== null);
  const planVals = data.planMix.map((p) => (byMrr ? Number(p.mrr) : p.activeSubscriptions));
  const planSum = planVals.reduce((a, b) => a + b, 0);

  return (
    <Panel title="Tenant status" hint={total !== undefined ? `${fmtInt(total)} total` : undefined} index={index} className="xl:col-span-4">
      {sum === 0 ? <EmptyNote>No tenants yet.</EmptyNote> : (
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="relative size-[130px] shrink-0" role="img" aria-label={`Tenant status: ${segs.map((s) => `${s.name} ${s.value}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={segs} dataKey="value" innerRadius={44} outerRadius={60} paddingAngle={segs.length > 1 ? 2 : 0} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={!reduce} animationDuration={500}>
                  {segs.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <span className="pointer-events-none absolute inset-0 grid place-items-center text-lg font-semibold tabular-nums">{fmtInt(total ?? sum)}</span>
          </div>
          <ul className="grid min-w-[130px] flex-1 gap-1.5 text-[12.5px]">
            {segs.map((s) => (
              <li key={s.name} className="flex items-center gap-2"><i className="size-[9px] rounded-[3px]" style={{ background: s.color }} aria-hidden />{s.name}<b className="ml-auto font-semibold tabular-nums">{fmtInt(s.value)}</b></li>
            ))}
          </ul>
        </div>
      )}
      {planSum > 0 ? (
        <div className="mt-4">
          <p className="mb-1.5 text-xs text-muted-foreground">{byMrr ? 'Plan mix by MRR' : 'Plan mix by active subscriptions'}</p>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Plan mix">
            {data.planMix.map((p, i) => planVals[i]! > 0 ? <i key={p.planId} className="block h-full" style={{ width: `${(planVals[i]! / planSum) * 100}%`, background: PLAN_COLORS[i % PLAN_COLORS.length] }} /> : null)}
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {data.planMix.map((p, i) => (
              <li key={p.planId} className="flex min-w-0 items-center gap-1.5"><i className="size-2 shrink-0 rounded-sm" style={{ background: PLAN_COLORS[i % PLAN_COLORS.length] }} aria-hidden /><span className="truncate">{p.planName}</span><b className="ml-auto tabular-nums">{Math.round((planVals[i]! / planSum) * 100)}%</b></li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}

interface Bucket { label: string; signups: number; churned: number | null }

function bucketize(data: DashboardOverview): { rows: Bucket[]; unit: string; hasChurn: boolean } {
  const churn = data.churnedDaily ?? null;
  const cm = new Map((churn ?? []).map((c) => [c.date, c.count]));
  const n = data.signupsDaily.length;
  const size = n <= 14 ? 1 : n <= 100 ? 7 : 30;
  const rows: Bucket[] = [];
  for (let i = 0; i < n; i += size) {
    const chunk = data.signupsDaily.slice(i, i + size);
    rows.push({
      label: shortDate(chunk[0]!.date),
      signups: chunk.reduce((a, c) => a + c.count, 0),
      churned: churn ? chunk.reduce((a, c) => a + (cm.get(c.date) ?? 0), 0) : null,
    });
  }
  return { rows, unit: size === 1 ? 'daily' : size === 7 ? 'weekly' : 'monthly', hasChurn: !!churn && churn.length > 0 };
}

export function SignupsVsChurn({ data, index, className }: { data: DashboardOverview; index: number; className: string }) {
  const reduce = !!useReducedMotion();
  const { rows, unit, hasChurn } = useMemo(() => bucketize(data), [data]);
  const any = rows.some((r) => r.signups > 0 || (r.churned ?? 0) > 0);
  return (
    <Panel title={hasChurn ? 'Signups vs churn' : 'New tenants'} hint={unit} index={index} className={className}>
      {!any ? <EmptyNote>No signups in this period.</EmptyNote> : (
        <>
          <div className="h-[190px] w-full" role="img" aria-label="Signups and churn bar chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barGap={4}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'var(--muted)' }} content={<ChartTooltip fmt={fmtInt} names={{ signups: 'New tenants', churned: 'Churned' }} />} />
                <RBar dataKey="signups" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={!reduce} animationDuration={450} />
                {hasChurn ? <RBar dataKey="churned" fill="var(--chart-5)" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={!reduce} animationDuration={450} /> : null}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-[var(--chart-1)]" aria-hidden />New tenants</span>
            {hasChurn ? <span className="flex items-center gap-1.5"><i className="size-2 rounded-sm bg-[var(--chart-5)]" aria-hidden />Churned</span> : null}
          </div>
        </>
      )}
    </Panel>
  );
}

export function TrialFunnel({ funnel, rangeLabel, index }: { funnel: NonNullable<DashboardOverview['trialFunnel']>; rangeLabel: string; index: number }) {
  const base = Math.max(funnel.started, 1);
  const rows = [
    { label: 'Trials started', n: funnel.started, color: 'var(--chart-3)', pct: false },
    { label: 'Activated (added members)', n: funnel.activated, color: 'var(--chart-2)', pct: true },
    { label: 'Converted to paid', n: funnel.converted, color: 'var(--chart-6)', pct: true },
    { label: 'Expired without paying', n: funnel.expired, color: 'var(--chart-7)', pct: true },
  ];
  return (
    <Panel title="Trial funnel" hint={rangeLabel} index={index} className="xl:col-span-6">
      <ul className="grid gap-3">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="mb-1 flex justify-between text-[12.5px]"><span>{r.label}</span><b className="tabular-nums">{fmtInt(r.n)}{r.pct && funnel.started > 0 ? ` · ${Math.round((r.n / base) * 100)}%` : ''}</b></div>
            <Bar pct={(r.n / base) * 100} color={r.color} height={12} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function CountryBars({ rows, index }: { rows: DashboardOverview['countries']; index: number }) {
  const max = Math.max(...rows.map((r) => r.tenantCount), 1);
  return (
    <Panel title="Where tenants are" hint="by country" index={index}>
      <ul className="grid gap-2.5">
        {rows.slice(0, 6).map((c) => (
          <li key={c.country}>
            <div className="mb-1 flex justify-between text-[12.5px]"><span>{c.country}</span><b className="tabular-nums">{fmtInt(c.tenantCount)}</b></div>
            <Bar pct={(c.tenantCount / max) * 100} color="var(--chart-2)" />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function SupportCard({ t, index }: { t: NonNullable<DashboardOverview['supportTickets']>; index: number }) {
  return (
    <Panel title="Support tickets" hint={t.oldestOpenDays !== null ? `oldest open ${t.oldestOpenDays}d` : undefined} index={index}>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[['Open', t.open, 'red'], ['In progress', t.inProgress, 'amber'], ['Resolved', t.resolved, 'green']].map(([l, n, tone]) => (
          <div key={String(l)} className="rounded-lg bg-muted/60 px-2 py-2">
            <dd className="text-xl font-semibold tabular-nums">{fmtCompact(Number(n))}</dd>
            <dt className="mt-0.5"><Chip tone={tone as 'red' | 'amber' | 'green'}>{l}</Chip></dt>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
