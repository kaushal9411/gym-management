'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const HERO_BG =
  'radial-gradient(900px 320px at 88% -30%, color-mix(in oklch, #c026d3 75%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)';

/** Translucent (default) or solid-white hero action button/link. Pass `href` for a link. */
export function HeroButton({
  href,
  solid,
  danger,
  className,
  children,
  ...rest
}: {
  href?: string;
  solid?: boolean;
  danger?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = cn(
    'inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-xl border px-[18px] text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-60',
    solid ? 'border-white bg-white hover:bg-white/90' : 'border-white/30 bg-white/15 text-white hover:bg-white/25',
    solid && (danger ? 'text-[#c0262f]' : 'text-[#4338ca]'),
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

export interface HeroStat {
  value: React.ReactNode;
  label: string;
}

/** Gradient hero shared by `/payments`, `/payments/[id]` and `/payments/new` (same pattern as StaffHero / IamHero). */
export function PaymentsHero({
  eyebrow,
  title,
  titleAdornment,
  subtitle,
  backHref,
  backLabel = 'Back to payments',
  stats,
  statsLoading,
  actions,
  aside,
}: {
  eyebrow: string;
  title: React.ReactNode;
  titleAdornment?: React.ReactNode;
  subtitle?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  stats?: HeroStat[];
  statsLoading?: boolean;
  actions?: React.ReactNode;
  /** Replaces `actions` slot content with arbitrary right-hand content (e.g. the step indicator). */
  aside?: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-[28px] px-5 py-7 text-white shadow-lg sm:px-8 sm:py-9 lg:px-10"
      style={{ backgroundImage: HERO_BG }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)' }} />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-[260px] flex-[1_1_420px]">
          {backHref ? (
            <Link href={backHref} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-white/85 hover:text-white">
              <ArrowLeft className="size-3.5" /> {backLabel}
            </Link>
          ) : null}
          <p className={cn('text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80', backHref && 'mt-3.5')}>{eyebrow}</p>
          <div className="my-2 flex flex-wrap items-center gap-3.5">
            <h1 className="text-[34px] font-extrabold leading-[1.05] tabular-nums sm:text-[42px]">{title}</h1>
            {titleAdornment}
          </div>
          {subtitle ? <p className="max-w-[560px] text-[15px] leading-relaxed text-white/90">{subtitle}</p> : null}
          {stats ? (
            <div className="mt-5 flex flex-wrap gap-7">
              {stats.map((s) => (
                <div key={s.label}>
                  {statsLoading ? <Skeleton className="h-7 w-24 bg-white/25" /> : <div className="text-[26px] font-extrabold tabular-nums">{s.value}</div>}
                  <div className="text-xs font-semibold text-white/80">{s.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {aside ?? (actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null)}
      </div>
    </motion.section>
  );
}
