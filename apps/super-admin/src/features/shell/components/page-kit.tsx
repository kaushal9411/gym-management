'use client';

/** Shared bits for the redesigned CMS / releases / roles / settings pages (reuses the payments Banner + dashboard Panel/KpiCard). */
import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

export const FIELD = 'h-9 w-full rounded-[9px] border border-input bg-card px-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60';
export const TEXTAREA = 'w-full rounded-[9px] border border-input bg-card px-2.5 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60';

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Responsive KPI row. */
export function KpiGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 }) {
  return <div className={cn('grid grid-cols-2 gap-3', cols === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>{children}</div>;
}

/** Sticky, in-flow action bar (unsaved changes etc.). */
export function SaveBar({ dirty, message, children }: { dirty: boolean; message: React.ReactNode; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-[14px] border bg-card/95 py-3 pl-4 pr-20 shadow-lg backdrop-blur', dirty && 'border-amber-400/60')}
    >
      <span className={cn('flex min-w-0 flex-1 items-center gap-2 text-[13px]', dirty ? 'font-semibold text-amber-800 dark:text-amber-300' : 'text-muted-foreground')} aria-live="polite">
        <i aria-hidden className={cn('size-2 shrink-0 rounded-full', dirty ? 'bg-amber-500' : 'bg-emerald-500')} />
        {message}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </motion.div>
  );
}

export function fmtDateTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}
export function fmtDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';
}
