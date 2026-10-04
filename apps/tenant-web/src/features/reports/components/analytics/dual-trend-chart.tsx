'use client';

import * as React from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';

import { ANIM_MS, AXIS_TICK, ChartEmpty, ChartLegend, ChartTooltip, GRID_STROKE, hasSignal, useSvgId } from '../../charts/chart-shared';
import { useValueFormatter, type ValueFormat } from '../../lib/format';
import { PREVIOUS_COLOR } from '../../lib/reports-theme';
import type { MergedRow } from './use-analytics-series';

/** Two overlaid area series (e.g. Income vs Expenses) with optional dashed previous-period lines; legend items toggle series. */
export function DualTrendChart({
  rows,
  labels,
  colors = ['var(--chart-1)', 'var(--chart-2)'],
  format = 'money',
  showPrevious,
  height = 280,
}: {
  rows: MergedRow[];
  labels: [string, string];
  colors?: [string, string];
  format?: ValueFormat;
  showPrevious?: boolean;
  height?: number;
}) {
  const reduce = useReducedMotion();
  const fmt = useValueFormatter(format);
  const gid = useSvgId('dual');
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const hasPrev = !!showPrevious && rows.some((r) => r.pa !== undefined);
  const data = rows.map((r) => ({ label: r.label, tip: r.tip, a: r.a, b: r.b, [`pa`]: r.pa, pb: r.pb }));

  if (!rows.length || !hasSignal(rows.flatMap((r) => [r.a, r.b]))) return <ChartEmpty height={height} />;

  const items = [
    { key: 'a', label: labels[0], color: colors[0] },
    { key: 'b', label: labels[1], color: colors[1] },
    ...(hasPrev
      ? [
          { key: 'pa', label: `${labels[0]} (previous)`, color: PREVIOUS_COLOR, dashed: true },
          { key: 'pb', label: `${labels[1]} (previous)`, color: PREVIOUS_COLOR, dashed: true },
        ]
      : []),
  ];
  const area = (key: 'a' | 'b', name: string, color: string, i: number) =>
    hidden.has(key) ? null : (
      <Area key={key} type="monotone" dataKey={key} name={name} stroke={color} strokeWidth={2.5} fill={`url(#${gid}-${i})`} dot={false} activeDot={{ r: 4 }} isAnimationActive={!reduce} animationDuration={ANIM_MS} />
    );

  return (
    <div>
      <ChartLegend className="mb-2" items={items} hidden={hidden} onToggle={toggle} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {colors.map((c, i) => (
                <linearGradient key={c + i} id={`${gid}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={c} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => fmt(v, true)} />
            <Tooltip cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} content={<ChartTooltip format={fmt} />} />
            {hasPrev && !hidden.has('pa') ? <Line type="monotone" dataKey="pa" name={`${labels[0]} (previous)`} stroke={PREVIOUS_COLOR} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={!reduce} animationDuration={ANIM_MS} /> : null}
            {hasPrev && !hidden.has('pb') ? <Line type="monotone" dataKey="pb" name={`${labels[1]} (previous)`} stroke={PREVIOUS_COLOR} strokeWidth={2} strokeDasharray="2 4" dot={false} isAnimationActive={!reduce} animationDuration={ANIM_MS} /> : null}
            {area('b', labels[1], colors[1], 1)}
            {area('a', labels[0], colors[0], 0)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
