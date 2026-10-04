'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import * as React from 'react';

import { accentChipStyle, accentWash, type ReportAccent } from '@/features/reports/lib/reports-theme';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { cn } from '@/lib/utils';

/** Colour-coded panel: accent wash header with icon chip; animates in on mount. */
export function AccentPanel({ title, subtitle, icon: Icon, accent = 'members', action, className, children }: { title: string; subtitle?: React.ReactNode; icon: LucideIcon; accent?: ReportAccent; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  const m = useMotionSafe();
  return (
    <motion.section variants={m.fadeUp} initial={m.initial} animate="show" className={cn('min-w-0 overflow-hidden rounded-[20px] border bg-card text-card-foreground shadow-xs', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-[22px]" style={{ backgroundImage: accentWash(accent) }}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={accentChipStyle(accent)}>
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-extrabold leading-tight">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="px-5 py-5 sm:px-[22px]">{children}</div>
    </motion.section>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/50 px-3.5 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-0.5 truncate text-sm font-semibold">{children}</div>
    </div>
  );
}

export function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
