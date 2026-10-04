'use client';

import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { accentColor, type ReportAccent } from '../../lib/reports-theme';

export interface ChipOption {
  value: string;
  label: string;
  /** Optional coloured dot (a CSS colour/var). */
  dotColor?: string;
  count?: number;
}

/** Single-select chip row (e.g. "All / Active / Expired"); the active chip is filled with the accent. */
export function FilterChips({ options, value, onChange, accent = 'members', className }: { options: ChipOption[]; value: string; onChange: (v: string) => void; accent?: ReportAccent; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)} role="group">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <motion.button
            key={o.value}
            type="button"
            aria-pressed={active}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'border-transparent text-white shadow-sm' : 'border-input bg-card text-foreground/80 hover:bg-accent',
            )}
            style={active ? { backgroundColor: accentColor(accent) } : undefined}
          >
            {o.dotColor ? <span className="size-2 rounded-full" style={{ backgroundColor: o.dotColor }} aria-hidden /> : null}
            {o.label}
            {o.count !== undefined ? <span className={cn('tabular-nums', active ? 'opacity-85' : 'text-muted-foreground')}>{o.count}</span> : null}
          </motion.button>
        );
      })}
    </div>
  );
}
