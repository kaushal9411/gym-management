'use client';

import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { useReducedMotion } from 'framer-motion';

import { accentColor, type ReportAccent } from '../lib/reports-theme';
import { ANIM_MS, useSvgId } from './chart-shared';

/** Tiny axis-less area sparkline from `values`; `color` is any CSS colour or pass `accent`. */
export function SparkArea({ values, color, accent = 'members', height = 40, className }: { values: number[]; color?: string; accent?: ReportAccent; height?: number; className?: string }) {
  const reduce = useReducedMotion();
  const gid = useSvgId('spark');
  const stroke = color ?? accentColor(accent);
  if (values.length < 2) return <div style={{ height }} className={className} aria-hidden />;
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className={className} style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 3, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.4} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={2} fill={`url(#${gid})`} dot={false} isAnimationActive={!reduce} animationDuration={ANIM_MS} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
