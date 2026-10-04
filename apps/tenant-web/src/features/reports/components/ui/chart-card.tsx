'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMotionSafe } from '../../lib/motion';
import { EmptyState } from './empty-state';
import { SkeletonBlock } from './skeleton-block';

/** Panel shell for charts/lists: animated in-view mount, title/subtitle/actions, optional legend row, plus loading/error/empty bodies. */
export function ChartCard({
  title,
  subtitle,
  actions,
  legend,
  loading,
  error,
  empty,
  emptyText = 'No data for this period',
  errorText = 'Could not load this panel.',
  minHeight = 240,
  className,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  legend?: React.ReactNode;
  loading?: boolean;
  error?: boolean;
  empty?: boolean;
  emptyText?: string;
  errorText?: string;
  minHeight?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const m = useMotionSafe();
  return (
    <motion.section
      variants={m.fadeUp}
      initial={m.initial}
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      className={cn('min-w-0 rounded-[20px] border bg-card p-5 text-card-foreground shadow-xs sm:p-[22px]', className)}
    >
      {title || actions ? (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title ? <h2 className="text-[17px] font-extrabold leading-tight">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {legend && !loading && !error && !empty ? <div className="mb-2">{legend}</div> : null}
      {loading ? (
        <SkeletonBlock height={minHeight} />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title={errorText} compact accent="staff" />
      ) : empty ? (
        <EmptyState title={emptyText} compact className="justify-center" />
      ) : (
        children
      )}
    </motion.section>
  );
}
