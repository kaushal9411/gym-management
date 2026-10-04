'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { accentChipStyle, accentTint, accentWash, type ReportAccent } from '@/features/reports/lib/reports-theme';
import { StaggerItem } from '@/features/reports/components/ui';
import { cn } from '@/lib/utils';

export const selectClassName = cn(
  'flex h-10 w-full items-center rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40',
);

export const textareaClassName =
  'flex w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm shadow-xs transition-all duration-150 placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40';

/** Colour-coded settings section: accent-washed header with an icon chip. Must sit inside a `StaggerGroup` (renders a `StaggerItem`). */
export function SectionCard({
  tone,
  icon: Icon,
  title,
  subtitle,
  action,
  className,
  children,
}: {
  tone: ReportAccent;
  icon: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <StaggerItem className={cn('min-w-0', className)}>
      <section className="overflow-hidden rounded-[20px] border bg-card text-card-foreground shadow-xs transition-shadow duration-200 hover:shadow-sm">
        <header className="flex flex-wrap items-center gap-3 border-b px-5 py-4 sm:px-6" style={{ backgroundImage: accentWash(tone), borderBottomColor: accentTint(tone, 22) }}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={accentChipStyle(tone)}>
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-extrabold leading-tight">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p> : null}
          </div>
          {action}
        </header>
        <div className="space-y-4 p-5 sm:p-6">{children}</div>
      </section>
    </StaggerItem>
  );
}

/** Label + control (+ optional hint) wrapper used inside field grids. */
export function Field({ label, htmlFor, required, hint, className, children }: { label: React.ReactNode; htmlFor?: string; required?: boolean; hint?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Form column + sticky live-preview column (stacked below xl). */
export function SettingsLayout({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className={cn('grid items-start gap-5', aside && 'xl:grid-cols-[minmax(0,1fr)_380px]')}>
      <div className="min-w-0">{children}</div>
      {aside ? <aside className="min-w-0 space-y-5 xl:sticky xl:top-20">{aside}</aside> : null}
    </div>
  );
}

/** Small tinted pill (status chip). Renders a span so it is safe inside <p>. */
export function StatusChip({ tone = 'operations', icon: Icon, children }: { tone?: ReportAccent | 'good' | 'muted'; icon?: LucideIcon; children: React.ReactNode }) {
  const style: React.CSSProperties =
    tone === 'good'
      ? { backgroundColor: 'color-mix(in oklch, var(--success) 15%, transparent)', color: 'var(--success)' }
      : tone === 'muted'
        ? { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }
        : accentChipStyle(tone);
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold" style={style}>
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Preview shell: titled, dashed-edge "live preview" frame. */
export function PreviewCard({ title, subtitle, tone = 'analytics', icon: Icon, children }: { title: string; subtitle?: string; tone?: ReportAccent; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <StaggerItem>
      <section className="overflow-hidden rounded-[20px] border bg-card shadow-xs">
        <header className="flex items-center gap-2.5 border-b px-4 py-3" style={{ backgroundImage: accentWash(tone) }}>
          <span className="flex size-8 items-center justify-center rounded-lg" style={accentChipStyle(tone)}>
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold leading-tight">{title}</h2>
            <p className="text-[11px] text-muted-foreground">{subtitle ?? 'Live preview - updates as you type'}</p>
          </div>
        </header>
        <div className="p-4">{children}</div>
      </section>
    </StaggerItem>
  );
}
