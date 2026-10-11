'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, CalendarDays, CalendarRange, Sun, UserCheck, UserPlus, type LucideIcon } from 'lucide-react';

import { AnimatedNumber, SkeletonBlock, StaggerGroup } from '@/features/reports/components/ui';
import { accentChipStyle, accentWash, type ReportAccent } from '@/features/reports/lib/reports-theme';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { cn } from '@/lib/utils';
import type { HeadlineBucket, LeadAnalytics } from '../../types';

function DeltaChip({ delta, vs }: { delta: number; vs: string }) {
  const color = delta > 0 ? 'var(--success)' : delta < 0 ? 'var(--destructive)' : 'var(--muted-foreground)';
  const Icon = delta < 0 ? ArrowDownRight : ArrowUpRight;
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums" style={{ color, backgroundColor: `color-mix(in oklch, ${color} 13%, transparent)` }}>
      {delta !== 0 ? <Icon className="size-3" aria-hidden /> : null}
      {delta > 0 ? `+${delta}` : delta === 0 ? '0' : delta}
      <span className="ml-0.5 font-semibold opacity-80">{vs}</span>
    </span>
  );
}

function Column({ label, icon: Icon, value, delta, vs, showDelta }: { label: string; icon: LucideIcon; value: number; delta: number; vs: string; showDelta: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-[32px] font-extrabold leading-none tabular-nums sm:text-[38px]">
        <AnimatedNumber value={value} />
      </p>
      <div className="mt-2 min-h-[22px]">{showDelta ? <DeltaChip delta={delta} vs={vs} /> : null}</div>
    </div>
  );
}

function Tile({ title, accent, icon: Icon, b, vs, showDelta }: { title: string; accent: ReportAccent; icon: LucideIcon; b: HeadlineBucket | undefined; vs: string; showDelta: boolean }) {
  const m = useMotionSafe();
  return (
    <motion.div variants={m.fadeUp} className="relative min-w-0 overflow-hidden rounded-[22px] border bg-card p-5 shadow-xs sm:p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: accentWash(accent) }} />
      <div className="relative">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl" style={accentChipStyle(accent)}>
            <Icon className="size-[18px]" aria-hidden />
          </span>
          <h2 className="text-lg font-extrabold">{title}</h2>
        </div>
        {b ? (
          <div className={cn('flex gap-5')}>
            <Column label="Enquiries" icon={UserPlus} value={b.newLeads} delta={b.newLeadsDelta} vs={vs} showDelta={showDelta} />
            <div aria-hidden className="w-px self-stretch bg-border" />
            <Column label="Converted" icon={UserCheck} value={b.converted} delta={b.convertedDelta} vs={vs} showDelta={showDelta} />
          </div>
        ) : (
          <SkeletonBlock height={90} />
        )}
      </div>
    </motion.div>
  );
}

/** Today / This month / This year - enquiries received + converted, independent of the selected range. */
export function HeadlineTiles({ data, compare }: { data: LeadAnalytics | undefined; compare: boolean }) {
  const h = data?.headline;
  return (
    <StaggerGroup step={0.08} className="grid gap-3.5 lg:grid-cols-3">
      <Tile title="Today" accent="attendance" icon={Sun} b={h?.today} vs="vs yesterday" showDelta={compare} />
      <Tile title="This month" accent="members" icon={CalendarDays} b={h?.thisMonth} vs="vs last month" showDelta={compare} />
      <Tile title="This year" accent="analytics" icon={CalendarRange} b={h?.thisYear} vs="vs last year" showDelta={compare} />
    </StaggerGroup>
  );
}
