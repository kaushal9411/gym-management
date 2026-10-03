'use client';

import * as React from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export type Accent = 'primary' | 'success' | 'warning' | 'destructive' | 'violet' | 'aqua';

const ACCENT_VAR: Record<Accent, string> = {
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  destructive: 'var(--destructive)',
  violet: 'var(--chart-7)',
  aqua: 'var(--chart-3)',
};

export function accentVar(accent: Accent): string {
  return ACCENT_VAR[accent];
}

export function tint(accent: Accent, percent: number): string {
  return `color-mix(in oklch, ${ACCENT_VAR[accent]} ${percent}%, transparent)`;
}

export function formatMoney(symbol: string, value: number | string): string {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `${symbol}${safe.toLocaleString(undefined, { minimumFractionDigits: Number.isInteger(safe) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** Counts up to `value` on mount; the final value is what renders first for reduced-motion users and in the first frame. */
export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const reduce = useReducedMotion();
  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString());
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    if (reduce || !ref.current) return;
    const el = ref.current;
    const controls = animate(0, value, { duration: 0.9, ease: 'easeOut', onUpdate: (v) => (el.textContent = fmt(v)) });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fmt` is an inline closure; re-running on every render would restart the animation.
  }, [value, reduce]);
  return <span ref={ref}>{fmt(value)}</span>;
}

/** Horizontal progress bar that fills in on mount. */
export function ProgressBar({ percent, accent, className }: { percent: number; accent: Accent; className?: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn('h-2 overflow-hidden rounded-full', className)} style={{ backgroundColor: tint(accent, 16) }}>
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundImage: `linear-gradient(90deg, ${accentVar(accent)}, color-mix(in oklch, ${accentVar(accent)} 55%, white))` }}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.9, delay: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </div>
  );
}

export function IconChip({ icon: Icon, accent, className }: { icon: LucideIcon; accent: Accent; className?: string }) {
  return (
    <span
      className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl', className)}
      style={{ backgroundColor: tint(accent, 16), color: accentVar(accent) }}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

/** Colorful card used by every new side panel: tinted gradient header, icon chip, optional right-hand slot. */
export function PanelCard({
  icon,
  accent,
  title,
  right,
  children,
  delay = 0,
}: {
  icon: LucideIcon;
  accent: Accent;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className="h-full overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xs transition-shadow duration-200 hover:shadow-md"
    >
      <header
        className="flex flex-wrap items-center gap-3 border-b px-5 py-3.5"
        style={{ backgroundImage: `linear-gradient(100deg, ${tint(accent, 13)}, transparent 80%)` }}
      >
        <IconChip icon={icon} accent={accent} />
        <h2 className="flex-1 text-base font-semibold tracking-tight">{title}</h2>
        {right}
      </header>
      <div className="space-y-4 p-5">{children}</div>
    </motion.section>
  );
}

/** Header style shared by every existing form card on the member page — same tinted gradient the new panels use. */
export function cardHeaderStyle(accent: Accent): React.CSSProperties {
  return { backgroundImage: `linear-gradient(100deg, ${tint(accent, 13)}, transparent 80%)` };
}
