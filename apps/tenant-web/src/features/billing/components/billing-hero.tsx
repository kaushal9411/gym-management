'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const HERO_BG =
  'radial-gradient(900px 320px at 88% -30%, color-mix(in oklch, #c026d3 75%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)';

// Same four sections the old BillingNav had (all gated by the nav's billing:read; the API enforces the rest).
const TABS = [
  { href: '/billing', label: 'Overview' },
  { href: '/billing/history', label: 'History' },
  { href: '/billing/invoices', label: 'Invoices' },
  { href: '/billing/address', label: 'Address' },
] as const;

export interface BillingHeroStat {
  value: React.ReactNode;
  label: string;
}

/** Shared gradient hero + tab bar for the four billing pages (replaces billing-nav.tsx; IamHero pattern). */
export function BillingHero({
  title = 'Billing & Subscription',
  subtitle,
  stats,
  statsLoading,
  actions,
}: {
  title?: string;
  subtitle?: React.ReactNode;
  stats?: BillingHeroStat[];
  statsLoading?: boolean;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative flex flex-col gap-5 overflow-hidden rounded-3xl px-5 pt-7 text-white shadow-lg sm:px-8 lg:px-10"
      style={{ backgroundImage: HERO_BG }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)' }} />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-[260px] flex-[1_1_420px]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">Subscription</p>
          <h1 className="my-2 text-[34px] font-extrabold leading-[1.05] sm:text-[42px]">{title}</h1>
          {subtitle ? <p className="max-w-[560px] text-[15px] leading-relaxed text-white/90">{subtitle}</p> : null}
          {stats ? (
            <div className="mt-5 flex flex-wrap gap-7">
              {stats.map((s) => (
                <div key={s.label}>
                  {statsLoading ? <Skeleton className="h-7 w-24 bg-white/25" /> : <div className="text-[24px] font-extrabold tabular-nums">{s.value}</div>}
                  <div className="text-xs font-semibold text-white/80">{s.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
      </div>

      <nav aria-label="Billing sections" className="relative -mb-px flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = t.href === '/billing' ? pathname === '/billing' : pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex items-center whitespace-nowrap rounded-t-xl px-4 py-2.5 text-[13.5px] font-bold transition-colors',
                active ? 'bg-background text-primary' : 'text-white/80 hover:bg-white/10 hover:text-white',
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </motion.section>
  );
}
