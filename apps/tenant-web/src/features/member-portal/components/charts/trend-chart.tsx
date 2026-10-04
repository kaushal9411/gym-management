'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useMotionSafe } from '@/features/reports/lib/motion';
import { toneColor, type PortalTone } from '../kit';

export interface TrendSeries {
  key: string;
  label: string;
  tone: PortalTone;
}

/**
 * Portal-local recharts trend chart (no staff-plane hooks). `data` rows carry a
 * `label` x value plus one numeric (or null) field per series. One series ->
 * soft area; several -> lines. Colours are theme tokens; animation is off under
 * reduced motion.
 */
export function TrendChart({ data, series, unit = '', height = 190, domainPad = true }: { data: Record<string, string | number | null>[]; series: TrendSeries[]; unit?: string; height?: number; domainPad?: boolean }) {
  const m = useMotionSafe();
  const first = series[0];
  const axis = { fontSize: 11, fill: 'var(--muted-foreground)' };
  const tip = (
    <Tooltip
      cursor={{ stroke: 'var(--border)' }}
      contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--popover-foreground)' }}
      formatter={(v, name) => [`${v}${unit}`, String(name)]}
    />
  );
  const common = { data, margin: { top: 8, right: 12, bottom: 0, left: 0 } };
  const grid = <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />;
  const xAxis = <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />;
  const yAxis = <YAxis tick={axis} tickLine={false} axisLine={false} width={46} domain={domainPad ? ['auto', 'auto'] : [0, 'auto']} />;
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        {series.length === 1 && first ? (
          <AreaChart {...common}>
            <defs>
              <linearGradient id={`tc-${first.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={toneColor(first.tone)} stopOpacity={0.35} />
                <stop offset="100%" stopColor={toneColor(first.tone)} stopOpacity={0} />
              </linearGradient>
            </defs>
            {grid}
            {xAxis}
            {yAxis}
            {tip}
            <Area type="monotone" dataKey={first.key} name={first.label} stroke={toneColor(first.tone)} strokeWidth={2.5} fill={`url(#tc-${first.key})`} dot={{ r: 3 }} connectNulls isAnimationActive={!m.reduce} />
          </AreaChart>
        ) : (
          <LineChart {...common}>
            {grid}
            {xAxis}
            {yAxis}
            {tip}
            {series.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={toneColor(s.tone)} strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={!m.reduce} />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend({ series }: { series: TrendSeries[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: toneColor(s.tone) }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}
