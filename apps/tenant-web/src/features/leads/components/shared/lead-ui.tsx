'use client';

import * as React from 'react';
import { CalendarClock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ageLabel, FOLLOW_UP_LABEL, formatDateTime, initials, SOURCE_META, STATUS_META } from '../../lib/lead-meta';
import type { FollowUpState, LeadSource, LeadStatus } from '../../types';

const mix = (c: string, p: number) => `color-mix(in oklch, ${c} ${p}%, transparent)`;

export function LeadAvatar({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.38, backgroundImage: 'linear-gradient(135deg, var(--chart-1), var(--chart-7))' }}
    >
      {initials(name)}
    </span>
  );
}

export function StatusPill({ status, className }: { status: LeadStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold', className)} style={{ color: m.color, backgroundColor: mix(m.color, 14) }}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: m.color }} aria-hidden />
      {m.label}
    </span>
  );
}

export function SourceChip({ source, className }: { source: LeadSource; className?: string }) {
  const m = SOURCE_META[source];
  const Icon = m.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold text-foreground/80', className)} style={{ backgroundColor: mix(m.color, 8) }}>
      <Icon className="size-3" style={{ color: m.color }} aria-hidden />
      {m.label}
    </span>
  );
}

const FU_COLOR: Record<FollowUpState, string> = { overdue: 'var(--destructive)', today: 'var(--warning)', upcoming: 'var(--chart-3)', none: 'var(--muted-foreground)' };

export function FollowUpBadge({ state, at, showTime, className }: { state: FollowUpState; at: string | null; showTime?: boolean; className?: string }) {
  if (state === 'none' || !at) return null;
  const color = FU_COLOR[state];
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold', className)} style={{ color, backgroundColor: mix(color, 14) }}>
      <CalendarClock className="size-3" aria-hidden />
      {showTime || state === 'upcoming' ? formatDateTime(at) : FOLLOW_UP_LABEL[state]}
    </span>
  );
}

export function AgeText({ createdAt }: { createdAt: string }) {
  return <span className="text-[11px] text-muted-foreground">{ageLabel(createdAt)} old</span>;
}

export function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </label>
  );
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[72px] w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-xs placeholder:text-muted-foreground/70',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
TextArea.displayName = 'TextArea';

export function InlineAlert({ children, tone = 'error' }: { children: React.ReactNode; tone?: 'error' | 'warning' }) {
  const color = tone === 'error' ? 'var(--destructive)' : 'var(--warning)';
  return (
    <div role="alert" className="rounded-xl border px-3.5 py-2.5 text-sm font-medium" style={{ borderColor: mix(color, 40), backgroundColor: mix(color, 9), color: tone === 'error' ? color : 'var(--foreground)' }}>
      {children}
    </div>
  );
}
