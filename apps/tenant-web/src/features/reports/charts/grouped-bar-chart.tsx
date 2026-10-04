'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';

import { useValueFormatter, type ValueFormat } from '../lib/format';
import { PREVIOUS_COLOR } from '../lib/reports-theme';
import { ANIM_MS, AXIS_TICK, ChartEmpty, ChartLegend, ChartTooltip, GRID_STROKE, hasSignal, type ChartPoint } from './chart-shared';

/** This-vs-previous grouped columns per category (e.g. weekday); omit `previous` on points for single bars. */
export function GroupedBarChart({
  data,
  format = 'number',
  color = 'var(--chart-2)',
  currentLabel = 'This period',
  previousLabel = 'Previous',
  height = 260,
}: {
  data: ChartPoint[];
  format?: ValueFormat;
  color?: string;
  currentLabel?: string;
  previousLabel?: string;
  height?: number;
}) {
  const reduce = useReducedMotion();
  const fmt = useValueFormatter(format);
  const hasPrev = data.some((d) => d.previous !== undefined);
  if (!data.length || !hasSignal(data.flatMap((d) => [d.value, d.previous]))) return <ChartEmpty height={height} />;
  const rows = data.map((d) => ({ label: d.label, tip: d.tip ?? d.label, current: d.value, previous: d.previous }));
  return (
    <div>
      <ChartLegend className="mb-2" items={[{ key: 'c', label: currentLabel, color }, ...(hasPrev ? [{ key: 'p', label: previousLabel, color: PREVIOUS_COLOR }] : [])]} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={3}>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => fmt(v, true)} />
            <Tooltip cursor={{ fill: 'color-mix(in oklch, var(--muted) 60%, transparent)' }} content={<ChartTooltip format={fmt} />} />
            {hasPrev ? <Bar dataKey="previous" name={previousLabel} fill="color-mix(in oklch, var(--muted-foreground) 45%, transparent)" radius={[6, 6, 0, 0]} maxBarSize={22} isAnimationActive={!reduce} animationDuration={ANIM_MS} /> : null}
            <Bar dataKey="current" name={currentLabel} fill={color} radius={[6, 6, 0, 0]} maxBarSize={26} isAnimationActive={!reduce} animationDuration={ANIM_MS} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
