'use client';

import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { fmtInt } from '@/features/dashboard/components/format';
import { Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { money } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { useRevenueSummaryV2 } from '../api/overview';
import { CHART, GrowBar, NotTracked, num, type TabData } from './common';

export function PlansTab({ data }: TabData) {
  const reduce = !!useReducedMotion();
  const cur = data.currency;
  const plans = data.mrrByPlan;
  const total = plans.reduce((a, p) => a + num(p.mrr), 0);
  const maxMrr = Math.max(1, ...plans.map((p) => num(p.mrr)));
  const summary = useRevenueSummaryV2();
  const byCur = summary.data?.mrrByCurrency ?? [];

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
      <Panel title="MRR by plan" hint={`active paid subscriptions · ${cur}`} index={0} className="md:col-span-2 xl:col-span-8">
        {plans.length === 0 ? <EmptyNote>No active paid subscriptions yet.</EmptyNote> : (
          <ul className="space-y-3.5">
            {plans.map((p, i) => (
              <li key={p.planId}>
                <div className="mb-1 flex items-baseline gap-2 text-[13px]">
                  <Link href={`/plans/${p.planId}`} className="truncate font-semibold outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">{p.planName}</Link>
                  <span className="text-xs text-muted-foreground">{fmtInt(p.activeSubscribers)} active</span>
                  <b className="ml-auto tabular-nums">{money(p.mrr, cur)}</b>
                  <span className="w-11 text-right text-xs tabular-nums text-muted-foreground">{Math.round(p.share * 1000) / 10}%</span>
                </div>
                <GrowBar pct={(num(p.mrr) / maxMrr) * 100} color={CHART[i % CHART.length]!} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Plan mix" hint="share of MRR" index={1} className="xl:col-span-4">
        {total === 0 ? <EmptyNote>No MRR to split yet.</EmptyNote> : (
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="relative size-[130px] shrink-0" role="img" aria-label={`Plan mix: ${plans.map((p) => `${p.planName} ${Math.round(p.share * 100)}%`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={plans.map((p) => ({ name: p.planName, value: num(p.mrr) }))} dataKey="value" innerRadius={44} outerRadius={60} paddingAngle={plans.length > 1 ? 2 : 0} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={!reduce} animationDuration={400}>
                    {plans.map((p, i) => <Cell key={p.planId} fill={CHART[i % CHART.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="grid min-w-[130px] flex-1 gap-1.5 text-[12.5px]">
              {plans.map((p, i) => (
                <li key={p.planId} className="flex items-center gap-2"><i className="size-[9px] shrink-0 rounded-[3px]" style={{ background: CHART[i % CHART.length] }} aria-hidden /><span className="truncate">{p.planName}</span><b className="ml-auto tabular-nums">{Math.round(p.share * 100)}%</b></li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Panel title="ARPA per plan" hint="MRR / active subscribers" index={2} className="xl:col-span-6">
        {plans.length === 0 ? <EmptyNote>No active paid subscriptions yet.</EmptyNote> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <caption className="sr-only">Average revenue per account by plan</caption>
              <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground"><th scope="col" className="border-b px-2 py-2">Plan</th><th scope="col" className="border-b px-2 py-2 text-right">Active</th><th scope="col" className="border-b px-2 py-2 text-right">MRR</th><th scope="col" className="border-b px-2 py-2 text-right">ARPA</th></tr></thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.planId}>
                    <td className="border-b border-border/60 px-2 py-2 font-medium">{p.planName}</td>
                    <td className="border-b border-border/60 px-2 py-2 text-right tabular-nums">{fmtInt(p.activeSubscribers)}</td>
                    <td className="border-b border-border/60 px-2 py-2 text-right tabular-nums">{money(p.mrr, cur)}</td>
                    <td className="border-b border-border/60 px-2 py-2 text-right font-semibold tabular-nums">{p.activeSubscribers > 0 ? money(num(p.mrr) / p.activeSubscribers, cur) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="MRR trend and new vs churned MRR" index={3} className="xl:col-span-6">
        {data.mrrHistory || data.newVsChurnedMrr ? <EmptyNote>MRR history is available but not rendered in this view yet.</EmptyNote> : <NotTracked title="MRR history, new vs churned MRR">Plan changes overwrite the plan on the subscription, so past MRR cannot be reconstructed.</NotTracked>}
        {byCur.length > 1 ? (
          <div className="mt-4">
            <p className="mb-1.5 text-xs text-muted-foreground">MRR by currency (plan currency, not converted)</p>
            <div className="flex flex-wrap gap-2">{byCur.map((c) => <Chip key={c.currency} tone="blue" className="text-xs">{c.currency} {money(c.mrr, c.currency)}</Chip>)}</div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
