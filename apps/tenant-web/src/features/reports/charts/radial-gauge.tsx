'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { AnimatedNumber } from '../components/ui/animated-number';
import { EASE } from '../lib/motion';

/** Progress ring: `value` of `max` (default 100) animates around; centre shows the percent unless `children` given. */
export function RadialGauge({
  value,
  max = 100,
  size = 120,
  thickness = 11,
  color = 'var(--chart-1)',
  label,
  children,
}: {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  color?: string;
  label?: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label ?? 'Progress'} ${Math.round(pct * 100)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in oklch, var(--muted-foreground) 16%, transparent)" strokeWidth={thickness} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - pct) : c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: reduce ? 0 : 1, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children ?? (
          <>
            <span className="text-xl font-extrabold tabular-nums">
              <AnimatedNumber value={pct * 100} format="percent" />
            </span>
            {label ? <span className="text-[11px] font-semibold text-muted-foreground">{label}</span> : null}
          </>
        )}
      </div>
    </div>
  );
}
