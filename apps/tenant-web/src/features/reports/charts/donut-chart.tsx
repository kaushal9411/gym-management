'use client';

import * as React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from 'recharts';
import { useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { useValueFormatter, type ValueFormat } from '../lib/format';
import { seriesColor } from '../lib/reports-theme';
import { ANIM_MS, ChartEmpty } from './chart-shared';

export interface DonutDatum {
  label: string;
  value: number;
  color?: string;
}

interface SectorProps {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
}

/** Donut with hover-grow slices, centre label (shows the hovered slice) and a legend of value + %; `side` puts the legend beside it. */
export function DonutChart({
  data,
  format = 'number',
  centerLabel = 'Total',
  centerValue,
  size = 190,
  side = true,
  maxLegend = 8,
}: {
  data: DonutDatum[];
  format?: ValueFormat;
  centerLabel?: string;
  /** Overrides the centre number (default = sum of values, formatted). */
  centerValue?: string;
  size?: number;
  side?: boolean;
  maxLegend?: number;
}) {
  const reduce = useReducedMotion();
  const fmt = useValueFormatter(format);
  const [active, setActive] = React.useState<number | undefined>(undefined);
  const items = data.map((d, i) => ({ ...d, value: Math.max(d.value, 0), color: d.color ?? seriesColor(i) }));
  const total = items.reduce((s, d) => s + d.value, 0);
  if (!items.length || total <= 0) return <ChartEmpty height={size} />;
  const hovered = active !== undefined ? items[active] : undefined;

  return (
    <div className={cn('flex gap-5', side ? 'flex-col items-center sm:flex-row' : 'flex-col items-center')}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              data={items}
              dataKey="value"
              nameKey="label"
              innerRadius="64%"
              outerRadius="92%"
              paddingAngle={items.length > 1 ? 2 : 0}
              cornerRadius={5}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={!reduce}
              animationDuration={ANIM_MS}
              activeIndex={active}
              activeShape={(props: unknown) => {
                const p = props as SectorProps;
                return <Sector {...p} outerRadius={p.outerRadius + 6} />;
              }}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(undefined)}
            >
              {items.map((d) => (
                <Cell key={d.label} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <span className="max-w-full truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{hovered ? hovered.label : centerLabel}</span>
          <span className="text-xl font-extrabold tabular-nums leading-tight">{hovered ? fmt(hovered.value, true) : (centerValue ?? fmt(total, true))}</span>
          {hovered ? <span className="text-xs font-semibold text-muted-foreground">{((hovered.value / total) * 100).toFixed(1)}%</span> : null}
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {items.slice(0, maxLegend).map((d, i) => (
          <li
            key={d.label}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(undefined)}
            className={cn('flex items-center gap-2 rounded-lg px-2 py-1 text-[13px] transition-colors', active === i && 'bg-muted')}
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate font-semibold">{d.label}</span>
            <span className="font-extrabold tabular-nums">{fmt(d.value, true)}</span>
            <span className="w-11 text-right text-xs font-semibold tabular-nums text-muted-foreground">{((d.value / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
        {items.length > maxLegend ? <li className="px-2 text-xs text-muted-foreground">+{items.length - maxLegend} more</li> : null}
      </ul>
    </div>
  );
}
