'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

import { GroupedBarChart, HBarChart, type ChartPoint } from '../../charts';
import { ChartCard } from '../ui';
import { num, useValueFormatter } from '../../lib/format';
import { staggerDelay, useMotionSafe } from '../../lib/motion';
import type { HubOverview } from './hub-utils';

interface Props {
  overview: HubOverview;
  loading: boolean;
  error: boolean;
  compare: boolean;
  previousLabel: string;
}

export function HubBranchesCard({ overview, loading, error, compare, previousLabel }: Props) {
  const m = useMotionSafe();
  const money = useValueFormatter('money');
  const src = overview?.branches;
  const data = React.useMemo<ChartPoint[]>(
    () => (src ?? []).map((b) => ({ label: b.name, value: num(b.revenue), previous: compare ? num(b.previousRevenue) : undefined })),
    [src, compare],
  );
  return (
    <ChartCard title="Branch comparison" subtitle="Revenue, members and attendance per branch" loading={loading} error={error} empty={!src?.length} emptyText="No branch data" minHeight={300}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GroupedBarChart data={data} format="money" color="var(--chart-2)" currentLabel="Revenue" previousLabel={previousLabel} />
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Branch</th>
                <th className="px-2 py-2 text-right">Revenue</th>
                <th className="px-2 py-2 text-right">New</th>
                <th className="px-2 py-2 text-right">Check-ins</th>
                <th className="py-2 pl-2 text-right">Active</th>
              </tr>
            </thead>
            <tbody>
              {(src ?? []).map((b, i) => (
                <motion.tr
                  key={b.branchId}
                  initial={m.reduce ? false : { opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: staggerDelay(i, 0.05) }}
                  className="border-b last:border-0 hover:bg-muted/50"
                >
                  <td className="max-w-[160px] truncate py-2.5 pr-3 font-semibold">{b.name}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{money(num(b.revenue), true)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{b.newMembers.toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{b.checkIns.toLocaleString()}</td>
                  <td className="py-2.5 pl-2 text-right tabular-nums">{b.activeMembers.toLocaleString()}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ChartCard>
  );
}

export function HubTrainersCard({ overview, loading, error }: Omit<Props, 'compare' | 'previousLabel'>) {
  const src = overview?.topTrainers;
  return (
    <ChartCard title="Top trainers" subtitle="By assigned members" loading={loading} error={error} empty={!src?.length}>
      <HBarChart data={(src ?? []).map((t) => ({ label: t.name, value: t.assignedMembers }))} color="var(--chart-4)" rankBadges limit={6} />
    </ChartCard>
  );
}
