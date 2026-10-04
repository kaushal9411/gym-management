'use client';

import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { delta } from './format';
import { CountUp } from './ui';

export interface KpiCardProps {
  label: string;
  value: number;
  format: (v: number) => string;
  previous?: number | null;
  /** Lower is better (churn): flips good/bad colouring. */
  invert?: boolean;
  /** Delta unit: percentage change (default) or absolute points. */
  deltaMode?: 'pct' | 'abs';
  absSuffix?: string;
  caption?: string;
  /** Used when there is no previous value to compare against. */
  fallbackCaption?: string;
  series?: number[];
  color: string;
  index: number;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const reduce = useReducedMotion();
  if (data.length < 2) return <div className="h-[30px]" aria-hidden />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 120},${27 - ((v - min) / span) * 23}`).join(' ');
  return (
    <svg viewBox="0 0 120 30" width="100%" height="30" preserveAspectRatio="none" aria-hidden className="mt-2">
      <motion.polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </svg>
  );
}

export function KpiCard(p: KpiCardProps) {
  const reduce = useReducedMotion();
  const d = delta(p.value, p.previous);
  const good = d ? (d.direction === 'flat' ? null : (d.direction === 'up') !== !!p.invert) : null;
  const arrow = d?.direction === 'up' ? '▲' : d?.direction === 'down' ? '▼' : '–';
  const amount = d && (p.deltaMode === 'abs' ? `${Math.abs(p.value - (p.previous ?? 0)).toFixed(p.absSuffix ? 1 : 0).replace(/\.0$/, '')}${p.absSuffix ?? ''}` : d.pct === null ? 'new' : `${Math.abs(Math.round(d.pct * 10) / 10)}%`);
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: reduce ? 0 : p.index * 0.03 }}
      className="min-w-0 rounded-[14px] border bg-card px-4 py-3.5"
    >
      <p className="text-xs font-medium text-muted-foreground">{p.label}</p>
      <p className="mb-0.5 mt-1 truncate text-[26px] font-semibold leading-[1.15] tracking-tight tabular-nums">
        <CountUp value={p.value} format={p.format} />
      </p>
      <p className="flex flex-wrap items-center gap-x-1.5 text-xs">
        {d ? (
          <span className={cn('font-semibold', good === null ? 'text-muted-foreground' : good ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>
            <span aria-hidden>{arrow}</span> {d.direction === 'flat' ? 'no change' : amount}
            <span className="sr-only">{d.direction === 'up' ? ' increase' : d.direction === 'down' ? ' decrease' : ''}</span>
          </span>
        ) : null}
        <span className="text-muted-foreground">{d ? (p.caption ?? 'vs prev') : (p.fallbackCaption ?? p.caption)}</span>
      </p>
      {p.series ? <Sparkline data={p.series} color={p.color} /> : null}
    </motion.div>
  );
}
