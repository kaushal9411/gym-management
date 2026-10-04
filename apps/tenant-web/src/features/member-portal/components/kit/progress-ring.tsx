'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { toneColor, type PortalTone } from './tones';

/**
 * Animated radial progress. `value` is 0-100 (clamped). `onDark` swaps to a
 * white ring for use on `PortalHero`. Children render centred (value/label).
 */
export function ProgressRing({
  value,
  size = 72,
  thickness = 7,
  tone = 'primary',
  onDark,
  children,
  className,
}: {
  value: number;
  size?: number;
  thickness?: number;
  tone?: PortalTone;
  onDark?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)) / 100;
  const r = (size - thickness) / 2;
  return (
    <div className={cn('relative inline-grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} stroke={onDark ? 'rgb(255 255 255 / 0.22)' : 'color-mix(in oklab, var(--muted-foreground) 18%, transparent)'} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          stroke={onDark ? '#fff' : toneColor(tone)}
          pathLength={1}
          strokeDasharray={1}
          initial={{ strokeDashoffset: reduce ? 1 - pct : 1 }}
          animate={{ strokeDashoffset: 1 - pct }}
          transition={{ duration: reduce ? 0 : 1.1, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      {children ? <div className="absolute inset-0 grid place-items-center text-center">{children}</div> : null}
    </div>
  );
}
