'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { toneColor, type PortalTone } from '../kit';

/** Springy ("bounce") transition; instant under reduced motion. */
export function useBounce() {
  const { reduce } = useMotionSafe();
  return React.useMemo(
    () => ({
      reduce,
      spring: reduce ? ({ duration: 0 } as const) : ({ type: 'spring', stiffness: 380, damping: 16, mass: 0.9 } as const),
      soft: reduce ? ({ duration: 0 } as const) : ({ type: 'spring', stiffness: 160, damping: 20 } as const),
    }),
    [reduce],
  );
}

/** Pops/bounces in when it first appears; `delay` in seconds (cascade). */
export function Pop({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const b = useBounce();
  return (
    <motion.div
      className={className}
      initial={b.reduce ? false : { opacity: 0, scale: 0.86, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ ...b.spring, delay: b.reduce ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

/** Button that squishes on press and springs back. */
export const PressButton = React.forwardRef<HTMLButtonElement, HTMLMotionProps<'button'>>(function PressButton({ className, disabled, ...props }, ref) {
  const b = useBounce();
  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={disabled}
      whileTap={disabled || b.reduce ? undefined : { scale: 0.92 }}
      whileHover={disabled || b.reduce ? undefined : { scale: 1.03 }}
      transition={b.spring}
      className={cn('focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60', className)}
      {...props}
    />
  );
});

/** Horizontal bar that grows from 0 to `value`% with a spring; tone-coloured gradient. */
export function GrowBar({ value, tone = 'primary', height = 10, delay = 0, label }: { value: number; tone?: PortalTone; height?: number; delay?: number; label?: string }) {
  const b = useBounce();
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)) / 100;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} className="overflow-hidden rounded-full bg-muted" style={{ height }}>
      <motion.div
        className="h-full w-full rounded-full"
        style={{ transformOrigin: 'left', background: `linear-gradient(90deg, ${toneColor(tone)}, color-mix(in oklab, ${toneColor(tone)} 55%, white))` }}
        initial={{ scaleX: b.reduce ? v : 0 }}
        animate={{ scaleX: v }}
        transition={b.reduce ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 14, delay }}
      />
    </div>
  );
}
