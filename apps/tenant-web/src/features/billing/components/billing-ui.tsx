'use client';

import * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function formatMoney(amount: number, currency: string, fractionDigits = 0): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: fractionDigits }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

const TONES = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-warning-foreground',
  danger: 'bg-destructive/10 text-destructive',
  primary: 'bg-primary/10 text-primary',
  muted: 'bg-muted text-muted-foreground',
} as const;
type Tone = keyof typeof TONES;

const STATUS_TONE: Record<string, Tone> = {
  // subscription
  TRIALING: 'primary',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  GRACE: 'warning',
  SUSPENDED: 'danger',
  CANCELED: 'muted',
  EXPIRED: 'muted',
  // payments
  SUCCEEDED: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REFUNDED: 'muted',
  PARTIALLY_REFUNDED: 'muted',
  // invoices
  PAID: 'success',
  OPEN: 'warning',
  DRAFT: 'muted',
  VOID: 'muted',
  UNCOLLECTIBLE: 'danger',
};

/** Pill badge for subscription / payment / invoice statuses (theme-token tints). */
export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold', TONES[STATUS_TONE[status] ?? 'muted'], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

/** Summary card (icon tile + label + value + optional hint). */
export function SummaryCard({
  icon,
  label,
  value,
  hint,
  color = 'var(--chart-1)',
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  color?: string;
  loading?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-[20px] border bg-card p-5 text-card-foreground shadow-xs">
      <div className="flex items-center gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5"
          style={{ backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`, color }}
        >
          {icon}
        </span>
        <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
      </div>
      {loading ? <Skeleton className="mt-3 h-8 w-28" /> : <div className="mt-3 truncate text-[26px] font-extrabold leading-none tabular-nums">{value}</div>}
      {hint ? <div className="mt-1.5 text-xs font-semibold text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function EmptyBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary [&_svg]:size-6">{icon}</span>
      <p className="font-bold">{title}</p>
      {children ? <p className="max-w-md text-sm text-muted-foreground">{children}</p> : null}
    </div>
  );
}
