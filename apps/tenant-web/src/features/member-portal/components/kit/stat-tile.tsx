'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { AnimatedNumber } from './animated-number';
import { toneChipStyle, toneColor, toneWash, type PortalTone } from './tones';

/**
 * KPI tile. `value` number -> count-up (`format` formats it) or a string/node
 * shown as-is. `hint` small line under the value. `progress` (0-100) draws a
 * thin animated bar. `delta` shows +/- vs previous (`invert` = lower is
 * better). `onClick` or `href` makes the whole tile a >=44px tap target.
 * Place tiles in a `StaggerGroup` grid (cascade) - the tile is a stagger child.
 */
export function StatTile({
  label,
  value,
  format,
  icon: Icon,
  tone = 'primary',
  hint,
  progress,
  delta,
  invert,
  onClick,
  href,
  className,
}: {
  label: string;
  value: number | string | React.ReactNode;
  format?: (n: number) => string;
  icon: LucideIcon;
  tone?: PortalTone;
  hint?: React.ReactNode;
  progress?: number | null;
  delta?: { current: number; previous: number } | null;
  invert?: boolean;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const m = useMotionSafe();
  const diff = delta ? delta.current - delta.previous : 0;
  const good = invert ? diff < 0 : diff > 0;
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="grid size-9 place-items-center rounded-xl" style={toneChipStyle(tone)}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
        {delta && diff !== 0 ? (
          <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold', good ? 'bg-success/15 text-success' : 'bg-destructive/12 text-destructive')}>
            {diff > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(diff)}
          </span>
        ) : null}
      </div>
      <p className="mt-3 truncate text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-2xl font-semibold tabular-nums tracking-tight">
        {typeof value === 'number' ? <AnimatedNumber value={value} format={format} /> : value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p> : null}
      {typeof progress === 'number' ? (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full"
            style={{ background: toneColor(tone), transformOrigin: 'left' }}
            initial={{ scaleX: m.reduce ? progress / 100 : 0 }}
            animate={{ scaleX: Math.max(0, Math.min(100, progress)) / 100 }}
            transition={{ duration: m.reduce ? 0 : 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </div>
      ) : null}
    </>
  );
  const cls = cn(
    'relative block w-full min-w-0 overflow-hidden rounded-2xl border bg-card p-3.5 text-left shadow-xs md:p-4',
    (onClick || href) && 'transition active:scale-[0.98] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    className,
  );
  const wash = <span aria-hidden className="pointer-events-none absolute inset-0 opacity-70" style={{ background: toneWash(tone) }} />;
  return (
    <motion.div variants={m.fadeUp} className="min-w-0">
      {href ? (
        <Link href={href} className={cls}>
          {wash}
          <div className="relative">{body}</div>
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cls}>
          {wash}
          <div className="relative">{body}</div>
        </button>
      ) : (
        <div className={cls}>
          {wash}
          <div className="relative">{body}</div>
        </div>
      )}
    </motion.div>
  );
}
