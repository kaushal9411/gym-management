'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

import { GroupedBarChart, HBarChart } from '../../charts';
import { num, useValueFormatter, type ValueFormat } from '../../lib/format';
import { staggerDelay, useMotionSafe } from '../../lib/motion';
import { accentColor } from '../../lib/reports-theme';
import type { BranchComparisonRow } from '../../types';
import { DeltaBadge, SegmentedTabs } from '../ui';

type Metric = 'revenue' | 'members' | 'attendance';
const METRICS: Array<{ value: Metric; label: string; format: ValueFormat; title: string }> = [
  { value: 'revenue', label: 'Revenue', format: 'money', title: 'Revenue' },
  { value: 'members', label: 'Members', format: 'number', title: 'Active members' },
  { value: 'attendance', label: 'Attendance', format: 'number', title: 'Check-ins' },
];

const prevOf = (prev: BranchComparisonRow[] | undefined, id: string) => prev?.find((p) => p.branchId === id);

/** Compact revenue ranking for the overview grid. */
export function BranchOverviewChart({ rows, prev, compare }: { rows: BranchComparisonRow[]; prev?: BranchComparisonRow[]; compare: boolean }) {
  return <HBarChart data={rows.map((r) => ({ label: r.branch, value: num(r.revenue), previous: compare ? num(prevOf(prev, r.branchId)?.revenue) : undefined }))} format="money" color={accentColor('operations')} rankBadges />;
}

/** Focus view: metric switcher + grouped bars (this vs previous) + ranking table with revenue share. */
export function BranchFocus({ rows, prev, compare }: { rows: BranchComparisonRow[]; prev?: BranchComparisonRow[]; compare: boolean }) {
  const m = useMotionSafe();
  const [metric, setMetric] = React.useState<Metric>('revenue');
  const cfg = METRICS.find((x) => x.value === metric)!;
  const fmtMoney = useValueFormatter('money');
  const sorted = [...rows].sort((a, b) => num(b.revenue) - num(a.revenue));
  const totalRevenue = sorted.reduce((s, r) => s + num(r.revenue), 0) || 1;
  const hasPrev = compare && !!prev?.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted-foreground">{cfg.title} by branch</p>
        <SegmentedTabs options={METRICS.map(({ value, label }) => ({ value, label }))} value={metric} onChange={setMetric} accent="operations" size="sm" ariaLabel="Branch metric" />
      </div>
      <GroupedBarChart
        data={sorted.map((r) => ({ label: r.branch, value: num(r[metric]), previous: hasPrev ? num(prevOf(prev, r.branchId)?.[metric]) : undefined }))}
        format={cfg.format}
        color={accentColor('operations')}
        currentLabel="This period"
        previousLabel="Previous period"
        height={300}
      />
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5">#</th>
              <th className="px-4 py-2.5">Branch</th>
              <th className="px-4 py-2.5 text-right">Members</th>
              <th className="px-4 py-2.5">Revenue share</th>
              <th className="px-4 py-2.5 text-right">Revenue</th>
              <th className="px-4 py-2.5 text-right">Attendance</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const share = (num(r.revenue) / totalRevenue) * 100;
              const p = prevOf(prev, r.branchId);
              return (
                <tr key={r.branchId} className="border-b border-border/60 last:border-0 even:bg-muted/30 hover:bg-accent/60">
                  <td className="px-4 py-3">
                    <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-extrabold text-muted-foreground">{i + 1}</span>
                  </td>
                  <td className="px-4 py-3 font-bold">{r.branch}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.members.toLocaleString()}</td>
                  <td className="min-w-[160px] px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span className="relative h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--muted-foreground) 16%, transparent)' }}>
                        <motion.span
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ backgroundColor: accentColor('operations'), width: m.reduce ? `${share}%` : undefined }}
                          initial={m.reduce ? false : { width: 0 }}
                          animate={{ width: `${share}%` }}
                          transition={{ duration: 0.7, delay: staggerDelay(i, 0.06) }}
                        />
                      </span>
                      <span className="w-10 text-right text-xs font-bold tabular-nums">{Math.round(share)}%</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold tabular-nums">{fmtMoney(num(r.revenue))}</span>
                    {hasPrev && p ? (
                      <span className="ml-2 inline-block align-middle">
                        <DeltaBadge value={num(r.revenue)} previous={num(p.revenue)} size="sm" />
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.attendance.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
