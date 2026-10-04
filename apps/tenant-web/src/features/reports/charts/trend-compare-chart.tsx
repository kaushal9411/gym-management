'use client';

import * as React from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';

import { SegmentedTabs } from '../components/ui/segmented-tabs';
import { useValueFormatter, type ValueFormat } from '../lib/format';
import { PREVIOUS_COLOR } from '../lib/reports-theme';
import { ANIM_MS, AXIS_TICK, ChartEmpty, ChartLegend, ChartTooltip, GRID_STROKE, hasSignal, useSvgId, type ChartPoint } from './chart-shared';

/** Current-vs-previous area/line chart; `cumulativeToggle` adds a Daily/Cumulative switch; `showPrevious=false` hides the dashed series. */
export function TrendCompareChart({
  data,
  format = 'number',
  color = 'var(--chart-1)',
  variant = 'area',
  currentLabel = 'Current',
  previousLabel = 'Previous',
  showPrevious = true,
  cumulativeToggle,
  cumulative: cumulativeProp,
  height = 280,
  hideLegend,
}: {
  data: ChartPoint[];
  format?: ValueFormat;
  color?: string;
  variant?: 'area' | 'line';
  currentLabel?: string;
  previousLabel?: string;
  showPrevious?: boolean;
  cumulativeToggle?: boolean;
  /** Controlled cumulative mode (hides the internal toggle state). */
  cumulative?: boolean;
  height?: number;
  hideLegend?: boolean;
}) {
  const reduce = useReducedMotion();
  const fmt = useValueFormatter(format);
  const gid = useSvgId('trend');
  const [mode, setMode] = React.useState<'daily' | 'cumulative'>('daily');
  const cumulative = cumulativeProp ?? mode === 'cumulative';
  const hasPrev = showPrevious && data.some((d) => d.previous !== undefined);

  const rows = React.useMemo(() => {
    let c = 0;
    let p = 0;
    return data.map((d) => {
      c += d.value;
      p += d.previous ?? 0;
      return { label: d.label, tip: d.tip ?? d.label, current: cumulative ? c : d.value, previous: d.previous === undefined ? undefined : cumulative ? p : d.previous };
    });
  }, [data, cumulative]);

  if (!data.length || !hasSignal(data.flatMap((d) => [d.value, d.previous]))) return <ChartEmpty height={height} />;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {hideLegend ? <span /> : <ChartLegend items={[{ key: 'c', label: currentLabel, color }, ...(hasPrev ? [{ key: 'p', label: previousLabel, color: PREVIOUS_COLOR, dashed: true }] : [])]} />}
        {cumulativeToggle && cumulativeProp === undefined ? (
          <SegmentedTabs
            size="sm"
            ariaLabel="Series mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'cumulative', label: 'Cumulative' },
            ]}
          />
        ) : null}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => fmt(v, true)} />
            <Tooltip cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} content={<ChartTooltip format={fmt} />} />
            {hasPrev ? <Line type="monotone" dataKey="previous" name={previousLabel} stroke={PREVIOUS_COLOR} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={!reduce} animationDuration={ANIM_MS} /> : null}
            {variant === 'area' ? (
              <Area type="monotone" dataKey="current" name={currentLabel} stroke={color} strokeWidth={2.5} fill={`url(#${gid})`} dot={false} activeDot={{ r: 4 }} isAnimationActive={!reduce} animationDuration={ANIM_MS} />
            ) : (
              <Line type="monotone" dataKey="current" name={currentLabel} stroke={color} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={!reduce} animationDuration={ANIM_MS} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
