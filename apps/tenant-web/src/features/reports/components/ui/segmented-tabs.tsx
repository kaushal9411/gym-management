'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { accentColor, type ReportAccent } from '../../lib/reports-theme';
import { useMotionSafe } from '../../lib/motion';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

/** Animated pill switcher (sliding highlight via layoutId); controlled via `value`/`onChange`. */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  accent = 'members',
  size = 'md',
  className,
  ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  accent?: ReportAccent;
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}) {
  const id = React.useId();
  const m = useMotionSafe();
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('relative inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full border bg-muted/60 p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              size === 'sm' ? 'h-7 px-3 text-xs' : 'h-8 px-4 text-[13px]',
              active ? 'text-white' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active ? (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-full shadow-sm"
                style={{ backgroundColor: accentColor(accent) }}
                transition={m.reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {o.icon ? <o.icon className="size-3.5" aria-hidden /> : null}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
