'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { SparkArea } from '../../charts/spark-area';
import type { ValueFormat } from '../../lib/format';
import { accentChipStyle, accentColor, accentWash, type ReportAccent } from '../../lib/reports-theme';
import { useMotionSafe } from '../../lib/motion';
import { AnimatedNumber } from './animated-number';
import { DeltaBadge } from './delta-badge';
import { SkeletonBlock } from './skeleton-block';

/** KPI card: icon chip, label, count-up value, delta vs `previous` (`invert` for expenses/churn), optional sparkline; place inside `StaggerGroup` for cascade. */
export function KpiTile({
  label,
  value,
  format = 'number',
  previous,
  invert,
  icon: Icon,
  accent = 'members',
  sparkline,
  hint,
  loading,
  compact,
  className,
}: {
  label: string;
  value: number;
  format?: ValueFormat;
  previous?: number | null;
  invert?: boolean;
  icon?: LucideIcon;
  accent?: ReportAccent;
  sparkline?: number[];
  hint?: React.ReactNode;
  loading?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const m = useMotionSafe();
  return (
    <motion.div
      variants={m.fadeUp}
      whileHover={m.reduce ? undefined : { y: -3 }}
      whileTap={m.reduce ? undefined : { scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className={cn('relative min-w-0 overflow-hidden rounded-[20px] border bg-card p-4 text-card-foreground shadow-xs transition-shadow hover:shadow-md sm:p-5', className)}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: accentWash(accent) }} />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
          {Icon ? (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={accentChipStyle(accent)}>
              <Icon className="size-4" aria-hidden />
            </span>
          ) : null}
        </div>
        {loading ? (
          <SkeletonBlock height={30} className="mt-3 w-28" />
        ) : (
          <>
            <p className="mt-2 text-[26px] font-extrabold leading-none tabular-nums sm:text-[28px]">
              <AnimatedNumber value={value} format={format} compact={compact} />
            </p>
            <div className="mt-2 flex min-h-[22px] flex-wrap items-center gap-1.5">
              <DeltaBadge value={value} previous={previous} invert={invert} size="sm" />
              {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
            </div>
            {sparkline && sparkline.length > 1 ? <SparkArea values={sparkline} color={accentColor(accent)} height={36} className="mt-2" /> : null}
          </>
        )}
      </div>
    </motion.div>
  );
}
