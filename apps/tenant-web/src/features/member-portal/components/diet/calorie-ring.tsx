'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

import { AnimatedNumber } from '../kit';
import { useBounce } from './motion-bits';

/**
 * Calorie ring: gradient stroke (theme tokens) that springs to `eaten / planned`.
 * `planned` <= 0 means there is no figure to compare with, so the ring stays empty.
 */
export function CalorieRing({ eaten, planned, size = 176, thickness = 15 }: { eaten: number; planned: number; size?: number; thickness?: number }) {
  const b = useBounce();
  const id = React.useId().replace(/:/g, '');
  const fraction = planned > 0 ? Math.max(0, Math.min(1, eaten / planned)) : 0;
  const r = (size - thickness) / 2;
  return (
    <div className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={planned > 0 ? `${Math.round(eaten)} of ${Math.round(planned)} calories eaten` : `${Math.round(eaten)} calories eaten`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--chart-2)" />
            <stop offset="55%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--chart-7)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} stroke="color-mix(in oklab, var(--muted-foreground) 16%, transparent)" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          stroke={`url(#ring-${id})`}
          pathLength={1}
          strokeDasharray={1}
          initial={{ strokeDashoffset: b.reduce ? 1 - fraction : 1 }}
          animate={{ strokeDashoffset: 1 - fraction }}
          transition={b.reduce ? { duration: 0 } : { type: 'spring', stiffness: 50, damping: 12, mass: 1.2 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-3xl font-semibold tabular-nums leading-none tracking-tight">
            <AnimatedNumber value={eaten} format={(n) => Math.round(n).toLocaleString('en-IN')} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{planned > 0 ? `of ${Math.round(planned).toLocaleString('en-IN')} kcal` : 'kcal eaten'}</p>
        </div>
      </div>
    </div>
  );
}
