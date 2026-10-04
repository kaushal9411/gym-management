'use client';

import * as React from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';

import { useValueFormatter, type ValueFormat } from '../lib/format';
import { seriesColor } from '../lib/reports-theme';
import { ANIM_MS, AXIS_TICK, ChartEmpty, ChartLegend, ChartTooltip, GRID_STROKE, hasSignal, useSvgId } from './chart-shared';

export interface SeriesDef {
  /** Key into each data row. */
  key: string;
  label: string;
  type?: 'bar' | 'line' | 'area';
  color?: string;
}

export type MultiSeriesRow = { label: string; tip?: string } & Record<string, string | number | undefined>;

/** Composed bars + lines + areas (e.g. revenue vs expenses bars with a net line); legend items are click-to-hide. */
export function MultiSeriesChart({ data, series, format = 'money', height = 300 }: { data: MultiSeriesRow[]; series: SeriesDef[]; format?: ValueFormat; height?: number }) {
  const reduce = useReducedMotion();
  const fmt = useValueFormatter(format);
  const gid = useSvgId('multi');
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const defs = series.map((s, i) => ({ ...s, color: s.color ?? seriesColor(i), type: s.type ?? 'bar' }));

  if (!data.length || !hasSignal(data.flatMap((d) => defs.map((s) => Number(d[s.key] ?? 0))))) return <ChartEmpty height={height} />;

  return (
    <div>
      <ChartLegend className="mb-2" items={defs.map((s) => ({ key: s.key, label: s.label, color: s.color }))} hidden={hidden} onToggle={toggle} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={3}>
            <defs>
              {defs.map((s) => (
                <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={s.type === 'area' ? 0.3 : 1} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={s.type === 'area' ? 0 : 0.65} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => fmt(v, true)} />
            <Tooltip cursor={{ fill: 'color-mix(in oklch, var(--muted) 60%, transparent)' }} content={<ChartTooltip format={fmt} />} />
            {defs.map((s) => {
              if (hidden.has(s.key)) return null;
              const common = { dataKey: s.key, name: s.label, isAnimationActive: !reduce, animationDuration: ANIM_MS };
              if (s.type === 'line') return <Line key={s.key} {...common} type="monotone" stroke={s.color} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />;
              if (s.type === 'area') return <Area key={s.key} {...common} type="monotone" stroke={s.color} strokeWidth={2.5} fill={`url(#${gid}-${s.key})`} dot={false} />;
              return <Bar key={s.key} {...common} fill={`url(#${gid}-${s.key})`} radius={[6, 6, 0, 0]} maxBarSize={28} />;
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
