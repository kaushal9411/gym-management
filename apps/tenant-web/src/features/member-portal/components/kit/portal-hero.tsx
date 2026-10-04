'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { AnimatedNumber } from './animated-number';
import { HERO_GRADIENT, HERO_STRIPES } from './tones';

export interface PortalHeroStat {
  label: string;
  /** Numbers count up; nodes/strings render as-is. */
  value: number | React.ReactNode;
  /** Formatter for numeric values (e.g. `usePortalMoney().format`). */
  format?: (n: number) => string;
  /** Falsy -> chip hidden (honest-data rule: null hides). */
  hidden?: boolean;
}

/**
 * Tenant-primary gradient hero with stripe overlay (white text).
 * `eyebrow` small caps line, `title` big heading, `subtitle` muted line,
 * `chips` inline status chips (nodes), `stats` count-up stat chips,
 * `actions` button row (use `HeroButton`), `aside` right-hand slot (avatar /
 * `ProgressRing onDark`). Phone: aside sits top-right, content stacks.
 */
export function PortalHero({
  eyebrow,
  title,
  subtitle,
  chips,
  stats,
  actions,
  aside,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  chips?: React.ReactNode;
  stats?: PortalHeroStat[];
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  const m = useMotionSafe();
  const shown = (stats ?? []).filter((s) => !s.hidden);
  return (
    <motion.section
      variants={m.fadeUp}
      initial={m.initial}
      animate="show"
      className={cn('relative overflow-hidden rounded-3xl p-5 text-white shadow-lg md:p-7', className)}
      style={{ background: HERO_GRADIENT }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: HERO_STRIPES }} />
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="text-xs font-medium uppercase tracking-wider text-white/75">{eyebrow}</p> : null}
          <h1 className="mt-0.5 break-words text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-white/80">{subtitle}</p> : null}
          {chips ? <div className="mt-3 flex flex-wrap items-center gap-1.5">{chips}</div> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      {shown.length ? (
        <div className={cn('relative mt-5 grid gap-2', shown.length >= 3 ? 'grid-cols-3' : shown.length === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
          {shown.map((s) => (
            <div key={s.label} className="min-w-0 rounded-2xl bg-white/12 px-3 py-2.5 backdrop-blur-sm ring-1 ring-white/15">
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-white/70">{s.label}</p>
              <p className="mt-0.5 truncate text-lg font-semibold tabular-nums leading-tight md:text-xl">
                {typeof s.value === 'number' ? <AnimatedNumber value={s.value} format={s.format} /> : s.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {actions ? <div className="relative mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </motion.section>
  );
}

/** Hero action button (>=44px tap target). `variant="solid"` = white button, `ghost` = translucent. Renders `<a>`-like Link when `href` is set. */
export const HeroAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'solid' | 'ghost' }>(function HeroAction(
  { className, variant = 'ghost', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
        variant === 'solid' ? 'bg-white text-[color:var(--primary)] shadow-sm hover:bg-white/90' : 'bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25',
        className,
      )}
      {...props}
    />
  );
});

/** Link-styled hero action (use inside `PortalHero actions`). */
export function heroActionClass(variant: 'solid' | 'ghost' = 'ghost'): string {
  return cn(
    'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
    variant === 'solid' ? 'bg-white text-[color:var(--primary)] shadow-sm hover:bg-white/90' : 'bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25',
  );
}

/** Small translucent status chip for the hero `chips` slot. */
export function HeroChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/20', className)}>{children}</span>;
}
