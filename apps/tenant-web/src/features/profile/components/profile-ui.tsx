'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, type LucideIcon } from 'lucide-react';

import { accentChipStyle, accentColor, type ReportAccent } from '@/features/reports/lib/reports-theme';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { cn } from '@/lib/utils';

/** Animated pill switch (button role="switch"); label is wired through aria-labelledby. */
export function PrefSwitch({ id, label, hint, checked, disabled, onChange, accent = 'analytics' }: { id: string; label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; accent?: ReportAccent }) {
  const m = useMotionSafe();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-muted/40">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-sm font-semibold">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative h-6 w-[42px] shrink-0 rounded-full outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: checked ? accentColor(accent) : undefined }}
      >
        <span className={cn('absolute inset-0 -z-10 rounded-full bg-muted', checked && 'opacity-0')} />
        <motion.span
          className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow"
          animate={{ x: checked ? 18 : 0 }}
          transition={m.reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 32 }}
        />
      </button>
    </div>
  );
}

/** Completeness ring (SVG) — `percent` must come from real profile fields. */
export function CompletenessGauge({ percent, done, total }: { percent: number; done: number; total: number }) {
  const m = useMotionSafe();
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <div className="relative size-20 shrink-0">
        <svg viewBox="0 0 80 80" className="size-20 -rotate-90" aria-hidden>
          <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" stroke="var(--muted)" />
          <motion.circle
            cx="40" cy="40" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
            stroke={percent === 100 ? 'var(--success)' : accentColor('members')}
            strokeDasharray={c}
            initial={{ strokeDashoffset: m.reduce ? c * (1 - percent / 100) : c }}
            animate={{ strokeDashoffset: c * (1 - percent / 100) }}
            transition={{ duration: m.reduce ? 0 : 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-extrabold tabular-nums">{percent}%</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold">{percent === 100 ? 'Profile complete' : 'Profile completeness'}</p>
        <p className="text-xs text-muted-foreground">{done} of {total} details filled in</p>
      </div>
    </div>
  );
}

/** Quick-link card with tinted icon chip. */
export function QuickLinkCard({ href, label, hint, icon: Icon, accent }: { href: string; label: string; hint: string; icon: LucideIcon; accent: ReportAccent }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-xs outline-none transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105" style={accentChipStyle(accent)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
