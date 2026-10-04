'use client';

import { motion } from 'framer-motion';
import { Megaphone } from 'lucide-react';
import type * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedNumber } from '@/features/reports/components/ui';
import { EASE, useMotionSafe } from '@/features/reports/lib/motion';
import { COMM_HERO_GRADIENT } from '../lib/announcement-meta';

export interface AnnouncementsHeroStat {
  label: string;
  value: number;
}

/** Communication-gradient hero (same family as ReportsHero; the shared one can't take a custom accent). */
export function AnnouncementsHero({ stats, statsLoading, actions }: { stats?: AnnouncementsHeroStat[]; statsLoading?: boolean; actions?: React.ReactNode }) {
  const m = useMotionSafe();
  return (
    <motion.section
      initial={m.reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="relative overflow-hidden rounded-[28px] px-5 py-7 text-white shadow-lg sm:px-8 sm:py-9 lg:px-10"
      style={{ backgroundImage: COMM_HERO_GRADIENT }}
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
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-[260px] flex-[1_1_420px]">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">
            <Megaphone className="size-3.5" aria-hidden />
            Communication
          </p>
          <h1 className="my-2 text-[32px] font-extrabold leading-[1.05] sm:text-[40px]">Announcements</h1>
          <p className="max-w-[580px] text-[15px] leading-relaxed text-white/90">Broadcast news to your members and staff, schedule it ahead and see what is going out next.</p>
          {stats ? (
            <motion.div className="mt-5 flex flex-wrap gap-7" variants={m.staggerContainer(0.08, 0.25)} initial={m.initial} animate="show">
              {stats.map((s) => (
                <motion.div key={s.label} variants={m.fadeUp}>
                  {statsLoading ? <Skeleton className="h-7 w-16 bg-white/25" /> : <div className="text-[26px] font-extrabold tabular-nums"><AnimatedNumber value={s.value} /></div>}
                  <div className="text-xs font-semibold text-white/80">{s.label}</div>
                </motion.div>
              ))}
            </motion.div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
      </div>
    </motion.section>
  );
}
