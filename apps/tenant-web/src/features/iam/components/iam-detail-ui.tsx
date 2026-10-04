'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

import { type Accent, accentVar, CountUp, IconChip, tint } from '@/features/members/components/detail/detail-ui';
import { cn } from '@/lib/utils';

/** Shared by the role form and the user detail page: same gradient hero as /users/new, with optional leading slot / actions / chip row. */
export function HeroShell({
  kicker = 'Staff & Access',
  title,
  subtitle,
  leading,
  actions,
  children,
}: {
  kicker?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-3xl p-6 text-white shadow-lg sm:px-7"
      style={{ backgroundImage: 'radial-gradient(900px 320px at 88% -30%, color-mix(in oklch, #c026d3 75%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
      <div className="relative flex flex-wrap items-center gap-x-5 gap-y-4">
        {leading}
        <div className="min-w-0 flex-1 basis-60">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">{kicker}</p>
          <h1 className="mt-0.5 break-words text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          {subtitle ? <div className="mt-1 break-words text-white/85">{subtitle}</div> : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 [&_button:not([data-solid])]:border-white/30 [&_button:not([data-solid])]:bg-white/15 [&_button:not([data-solid])]:text-white [&_button:not([data-solid]):hover]:bg-white/25">
            {actions}
          </div>
        ) : null}
      </div>
      {children ? <div className="relative mt-4 flex flex-wrap gap-1.5">{children}</div> : null}
    </motion.section>
  );
}

export function HeroChip({ icon: Icon, children, className }: { icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-2.5 py-0.5 text-[11.5px] font-semibold', className)}>
      {Icon ? <Icon className="size-3" aria-hidden /> : null}
      {children}
    </span>
  );
}

export interface KpiTileData {
  key: string;
  label: string;
  icon: LucideIcon;
  accent: Accent;
  /** Numbers count up; strings render as-is. */
  value: number | string;
}

export function KpiTiles({ tiles, label }: { tiles: KpiTileData[]; label: string }) {
  const reduce = useReducedMotion();
  return (
    <section aria-label={label} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t, i) => (
        <motion.div key={t.key} initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={reduce ? undefined : { y: -3 }} transition={{ duration: 0.45, delay: 0.04 * i }}>
          <div
            className="h-full min-w-0 rounded-2xl border p-3.5 shadow-xs transition-shadow hover:shadow-md"
            style={{ backgroundImage: `linear-gradient(160deg, ${tint(t.accent, 13)}, transparent 72%)`, borderColor: tint(t.accent, 22) }}
          >
            <IconChip icon={t.icon} accent={t.accent} />
            <div className="mt-2.5 truncate text-2xl font-extrabold leading-tight tabular-nums" style={{ color: accentVar(t.accent) }}>
              {typeof t.value === 'number' ? <CountUp value={t.value} /> : t.value}
            </div>
            <div className="truncate text-xs font-medium text-muted-foreground">{t.label}</div>
          </div>
        </motion.div>
      ))}
    </section>
  );
}

/** Animated coverage ring (conic gradient that eases to `percent`). */
export function CoverageRing({ percent, accent = 'success', size = 84, children }: { percent: number; accent?: Accent; size?: number; children?: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = React.useState(reduce ? percent : 0);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setShown(percent));
    return () => cancelAnimationFrame(id);
  }, [percent]);
  const inner = size - 20;
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, backgroundImage: `conic-gradient(${accentVar(accent)} ${shown}%, ${tint(accent, 16)} 0)`, transition: reduce ? undefined : 'background 0.6s ease' }}
    >
      <div className="grid place-items-center rounded-full bg-card text-[15px] font-extrabold tabular-nums" style={{ width: inner, height: inner }}>
        {children ?? `${Math.round(percent)}%`}
      </div>
    </div>
  );
}

/** Pill shown on a section header when it has edits that were not saved yet. */
export function UnsavedChip() {
  return (
    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: tint('warning', 18), color: 'var(--warning)' }}>
      Unsaved changes
    </span>
  );
}

export function InfoBanner({ children, tone = 'primary' }: { children: React.ReactNode; tone?: Accent }) {
  return (
    <p role="status" className="rounded-2xl border px-4 py-3 text-sm font-medium" style={{ borderColor: tint(tone, 35), backgroundColor: tint(tone, 9) }}>
      {children}
    </p>
  );
}
