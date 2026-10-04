'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { ValueFormat } from '../../lib/format';
import { accentHeroGradient, type ReportAccent } from '../../lib/reports-theme';
import { EASE, useMotionSafe } from '../../lib/motion';
import { AnimatedNumber } from './animated-number';

export interface ReportsHeroStat {
  label: string;
  /** Numbers count up (using `format`); strings/nodes render as-is. */
  value: number | React.ReactNode;
  format?: ValueFormat;
}

export interface ReportsHeroTab {
  value: string;
  label: string;
  icon?: LucideIcon;
  /** When set the tab is a link (route tabs); otherwise `onTabChange` fires. */
  href?: string;
}

/** Gradient hero (PaymentsHero family): eyebrow/title/subtitle, count-up stats, actions slot, optional animated-underline tab bar. */
export function ReportsHero({
  eyebrow,
  title,
  subtitle,
  accent = 'analytics',
  icon: Icon,
  backHref,
  backLabel = 'Back to reports',
  stats,
  statsLoading,
  actions,
  aside,
  tabs,
  activeTab,
  onTabChange,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  accent?: ReportAccent;
  icon?: LucideIcon;
  backHref?: string;
  backLabel?: string;
  stats?: ReportsHeroStat[];
  statsLoading?: boolean;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  tabs?: ReportsHeroTab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
}) {
  const m = useMotionSafe();
  const tabId = React.useId();
  return (
    <motion.section
      initial={m.reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="relative overflow-hidden rounded-[28px] px-5 pt-7 text-white shadow-lg sm:px-8 sm:pt-9 lg:px-10"
      style={{ backgroundImage: accentHeroGradient(accent), paddingBottom: tabs ? 0 : undefined }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)' }} />
      {m.reduce ? null : (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-white/10 blur-2xl"
          animate={{ x: [0, -18, 0], y: [0, 14, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <div className={cn('relative flex flex-wrap items-end justify-between gap-6', tabs ? 'pb-5' : 'pb-7 sm:pb-9')}>
        <div className="min-w-[260px] flex-[1_1_420px]">
          {backHref ? (
            <Link href={backHref} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-white/85 hover:text-white">
              <ArrowLeft className="size-3.5" /> {backLabel}
            </Link>
          ) : null}
          <p className={cn('flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80', backHref && 'mt-3.5')}>
            {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
            {eyebrow}
          </p>
          <h1 className="my-2 text-[32px] font-extrabold leading-[1.05] sm:text-[40px]">{title}</h1>
          {subtitle ? <p className="max-w-[580px] text-[15px] leading-relaxed text-white/90">{subtitle}</p> : null}
          {stats ? (
            <motion.div className="mt-5 flex flex-wrap gap-7" variants={m.staggerContainer(0.08, 0.25)} initial={m.initial} animate="show">
              {stats.map((s) => (
                <motion.div key={s.label} variants={m.fadeUp}>
                  {statsLoading ? (
                    <Skeleton className="h-7 w-24 bg-white/25" />
                  ) : (
                    <div className="text-[26px] font-extrabold tabular-nums">{typeof s.value === 'number' ? <AnimatedNumber value={s.value} format={s.format} /> : s.value}</div>
                  )}
                  <div className="text-xs font-semibold text-white/80">{s.label}</div>
                </motion.div>
              ))}
            </motion.div>
          ) : null}
        </div>
        {aside ?? (actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null)}
      </div>
      {tabs ? (
        <div role="tablist" className="relative -mx-1 flex gap-1 overflow-x-auto border-t border-white/20 pt-1">
          {tabs.map((t) => {
            const active = t.value === activeTab;
            const cls = cn(
              'relative inline-flex h-11 items-center gap-1.5 whitespace-nowrap px-3.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
              active ? 'text-white' : 'text-white/70 hover:text-white',
            );
            const body = (
              <>
                {t.icon ? <t.icon className="size-4" aria-hidden /> : null}
                {t.label}
                {active ? (
                  <motion.span layoutId={`hero-tab-${tabId}`} className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-white" transition={m.reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }} />
                ) : null}
              </>
            );
            return t.href ? (
              <Link key={t.value} href={t.href} role="tab" aria-selected={active} className={cls}>
                {body}
              </Link>
            ) : (
              <button key={t.value} type="button" role="tab" aria-selected={active} onClick={() => onTabChange?.(t.value)} className={cls}>
                {body}
              </button>
            );
          })}
        </div>
      ) : null}
    </motion.section>
  );
}
