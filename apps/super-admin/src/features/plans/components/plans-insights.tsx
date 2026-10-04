'use client';

import { useReducedMotion } from 'framer-motion';
import { Bar as RBar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Skeleton } from '@/components/ui/skeleton';
import { ChartTooltip, Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { fmtInt, fmtMoneyCompact, fmtPct } from '@/features/dashboard/components/format';
import { ErrorNote } from '@/features/tenants/components/detail/tabs/_shared/kit';
import type { PlansOverview, RenewalBucket } from '../api/insights';
import { fmtPrice, planAccent } from '../lib/plan-utils';
import type { Plan } from '../types';
import { GrowBar, Legend, StackedBar } from './bars';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const weekLabel = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

/** Weekly expected-revenue bars (8 buckets; overdue ACTIVE renewals land in week 0). Shared with the plan detail page. */
export function RenewalsChart({ data, currency, color = 'var(--chart-2)' }: { data: RenewalBucket[]; currency: string; color?: string }) {
  const reduce = useReducedMotion();
  const rows = data.map((d) => ({ label: weekLabel(d.weekStart), expectedRevenue: Number(d.expectedRevenue), subscriptions: d.subscriptions }));
  const subs = rows.reduce((a, r) => a + r.subscriptions, 0);
  if (subs === 0) return <EmptyNote>No renewals due in the next 8 weeks.</EmptyNote>;
  return (
    <>
      <div className="h-[170px]" role="img" aria-label={`Expected renewal revenue per week for 8 weeks: ${rows.map((r) => `${r.label} ${r.subscriptions} renewals`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval={0} />
            <YAxis hide />
            <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ChartTooltip fmt={(v) => fmtPrice(v, currency)} names={{ expectedRevenue: 'Expected revenue' }} />} />
            <RBar dataKey="expectedRevenue" radius={[4, 4, 0, 0]} isAnimationActive={!reduce} animationDuration={250}>
              {rows.map((r) => <Cell key={r.label} fill={color} fillOpacity={r.subscriptions ? 1 : 0.25} />)}
            </RBar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{fmtInt(subs)} renewal{subs === 1 ? '' : 's'} · {fmtMoneyCompact(rows.reduce((a, r) => a + r.expectedRevenue, 0))} expected ({currency})</p>
    </>
  );
}

export function PlansInsights({ data, plans, isLoading, isError, onRetry }: { data?: PlansOverview; plans: Plan[]; isLoading: boolean; isError: boolean; onRetry: () => void }) {
  if (isLoading) return <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[260px] rounded-[14px]" />)}</div>;
  if (isError || !data) return <ErrorNote what="plan insights" onRetry={onRetry} />;
  const byMrr = [...data.byPlan].sort((a, b) => Number(b.mrr) - Number(a.mrr));
  const cur = data.kpis.currency;
  const pastDue = new Map(plans.map((p) => [p.id, p.stats?.pastDueSubscribers ?? 0]));
  const subRows = data.byPlan.map((p) => ({ ...p, pastDue: pastDue.get(p.planId) ?? 0 }));
  const maxSubs = Math.max(1, ...subRows.map((p) => p.activeSubscribers + p.trialSubscribers + p.pastDue));
  const maxPrice = Math.max(1, ...data.priceLadder.map((p) => Number(p.priceMonthly)));
  return (
    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
      <Panel title="MRR by plan" hint={cur} index={0} right={data.mrrByCurrency.length > 1 ? <span className="flex gap-1">{data.mrrByCurrency.map((c) => <Chip key={c.currency} tone="slate">{c.currency} {fmtMoneyCompact(c.mrr).replace('₹', '')}</Chip>)}</span> : undefined}>
        {byMrr.length === 0 ? <EmptyNote>No plans yet.</EmptyNote> : (
          <ul className="space-y-2.5">
            {byMrr.map((p, i) => (
              <li key={p.planId}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]"><span className="truncate font-medium">{p.name}</span><span className="tabular-nums text-muted-foreground"><b className="text-foreground">{fmtPrice(p.mrr, p.currency)}</b> · {fmtPct(p.share * 100)}</span></div>
                <GrowBar pct={p.share * 100} color={planAccent(p.slug)} delay={i * 0.03} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Subscribers by plan" index={1}>
        {subRows.length === 0 ? <EmptyNote>No plans yet.</EmptyNote> : (
          <>
            <ul className="space-y-2.5">
              {subRows.map((p) => (
                <li key={p.planId}>
                  <div className="mb-1 flex items-baseline justify-between text-[13px]"><span className="truncate font-medium">{p.name}</span><span className="tabular-nums text-muted-foreground">{fmtInt(p.activeSubscribers + p.trialSubscribers + p.pastDue)}</span></div>
                  <StackedBar max={maxSubs} label={p.name} parts={[{ value: p.activeSubscribers, color: 'var(--chart-6)', name: 'Active' }, { value: p.trialSubscribers, color: 'var(--chart-2)', name: 'Trial' }, { value: p.pastDue, color: 'var(--chart-4)', name: 'Past due' }]} />
                </li>
              ))}
            </ul>
            <div className="mt-3"><Legend items={[{ name: 'Active', color: 'var(--chart-6)' }, { name: 'Trial', color: 'var(--chart-2)' }, { name: 'Past due / grace', color: 'var(--chart-4)' }]} /></div>
          </>
        )}
      </Panel>

      <Panel title="Price ladder" hint="monthly vs yearly" index={2}>
        {data.priceLadder.length === 0 ? <EmptyNote>No plans yet.</EmptyNote> : (
          <>
            <ul className="space-y-3">
              {data.priceLadder.map((p, i) => (
                <li key={p.planId}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
                    <span className="truncate font-medium">{p.name}</span>
                    {p.yearlyDiscountPct !== null ? <Chip tone={p.yearlyDiscountPct > 0 ? 'green' : 'slate'}>{p.yearlyDiscountPct > 0 ? `save ${fmtPct(p.yearlyDiscountPct)}` : fmtPct(p.yearlyDiscountPct)} yearly</Chip> : null}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><GrowBar pct={(Number(p.priceMonthly) / maxPrice) * 100} color="var(--chart-1)" delay={i * 0.03} /></div><span className="w-32 shrink-0 whitespace-nowrap text-right text-xs tabular-nums">{fmtPrice(p.priceMonthly, p.currency)} /mo</span></div>
                    <div className="flex items-center gap-2"><div className="min-w-0 flex-1"><GrowBar pct={(Number(p.priceYearly) / 12 / maxPrice) * 100} color="var(--chart-3)" delay={i * 0.03 + 0.03} /></div><span className="w-32 shrink-0 whitespace-nowrap text-right text-xs tabular-nums">{fmtPrice(Number(p.priceYearly) / 12, p.currency)} /mo</span></div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3"><Legend items={[{ name: 'Monthly price', color: 'var(--chart-1)' }, { name: 'Yearly price ÷ 12', color: 'var(--chart-3)' }]} /></div>
          </>
        )}
      </Panel>

      <Panel title="Upcoming renewals" hint="next 8 weeks" index={3}>
        <RenewalsChart data={data.upcomingRenewals} currency={cur} />
      </Panel>
    </div>
  );
}
