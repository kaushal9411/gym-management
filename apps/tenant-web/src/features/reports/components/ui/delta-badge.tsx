'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { pctChange } from '../../lib/format';
import { BAD_COLOR, GOOD_COLOR, NEUTRAL_COLOR } from '../../lib/reports-theme';

/** % change chip vs `previous`; `invert` makes a decrease green (expenses, churn). Renders nothing without a previous value. */
export function DeltaBadge({
  value,
  previous,
  invert,
  suffix,
  size = 'md',
  className,
}: {
  value: number;
  previous?: number | null;
  invert?: boolean;
  suffix?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  if (previous === undefined || previous === null) return null;
  const pct = pctChange(value, previous);
  const flat = pct === 0;
  const up = (pct ?? 1) >= 0;
  const good = invert ? !up : up;
  const color = flat || pct === null ? NEUTRAL_COLOR : good ? GOOD_COLOR : BAD_COLOR;
  const Icon = flat || pct === null ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn('inline-flex items-center gap-0.5 rounded-full font-bold tabular-nums', size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs', className)}
      style={{ color, backgroundColor: `color-mix(in oklch, ${color} 13%, transparent)` }}
    >
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden />
      {pct === null ? 'New' : `${Math.abs(pct).toFixed(1)}%`}
      {suffix ? <span className="ml-0.5 font-semibold opacity-80">{suffix}</span> : null}
    </span>
  );
}
