'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

import { useTenant } from '@/features/tenant/tenant-provider';
import { cn } from '@/lib/utils';
import { StatusMedallion } from './status-screen';

interface AuthPanelProps {
  icon: LucideIcon;
  title: string;
  subtitle?: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'destructive';
  /** Optional step indicator rendered above the heading. */
  steps?: { labels: string[]; current: number };
  children: React.ReactNode;
  className?: string;
}

/** Numbered progress indicator for short multi-step flows (e.g. MFA setup). */
export function StepIndicator({ labels, current }: { labels: string[]; current: number }) {
  return (
    <ol className="flex items-center justify-center gap-2 text-xs" aria-label={`Step ${current + 1} of ${labels.length}`}>
      {labels.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold',
                done && 'border-success bg-success text-success-foreground',
                active && 'border-primary bg-primary text-primary-foreground',
                !done && !active && 'border-border text-muted-foreground',
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cn('hidden sm:inline', active ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{label}</span>
            {i < labels.length - 1 ? <span className={cn('h-px w-6 sm:w-8', done ? 'bg-success' : 'bg-border')} aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Circular countdown for resend cooldowns. */
export function CountdownRing({ remaining, total, label }: { remaining: number; total: number; label?: string }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const progress = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
  return (
    <span className="relative inline-flex size-9 shrink-0 items-center justify-center" role="img" aria-label={label ?? `${remaining} seconds remaining`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3" className="stroke-muted" />
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
      </svg>
      <span className="text-[10px] font-semibold tabular-nums text-muted-foreground" aria-hidden>{remaining}</span>
    </span>
  );
}

/** Loading placeholder with the same medallion language as the status screens. */
export function PanelSpinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10" role="status">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * Card shell for the form pages inside the `(auth)` split layout: gradient
 * accent bar, animated icon medallion, heading, then the form content.
 */
export function AuthPanel({ icon, title, subtitle, tone = 'neutral', steps, children, className }: AuthPanelProps) {
  const tenant = useTenant();
  const reduce = useReducedMotion() ?? false;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn('relative isolate overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm', className)}
    >
      <div aria-hidden className="h-1 w-full bg-gradient-to-r from-primary/0 via-primary to-primary/0" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-44 bg-gradient-to-b from-primary/10 to-transparent" />
      <div className="space-y-5 p-5 sm:p-8">
        {steps ? <StepIndicator labels={steps.labels} current={steps.current} /> : null}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="-my-3 scale-75">
            <StatusMedallion icon={icon} tone={tone} />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tenant.name}</p>
            <h1 className="text-balance text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle ? <p className="mx-auto max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {children}
      </div>
    </motion.div>
  );
}
