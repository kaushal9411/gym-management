'use client';

import { motion, useReducedMotion } from 'framer-motion';

/** Bar that grows from the left on mount (<= 250 ms); respects reduced motion. */
export function GrowBar({ pct, color, delay = 0, height = 8 }: { pct: number; color: string; delay?: number; height?: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="overflow-hidden rounded-full bg-muted" style={{ height }} role="presentation">
      <motion.div
        className="h-full origin-left rounded-full"
        style={{ width: `${Math.max(pct > 0 ? 2 : 0, Math.min(100, pct))}%`, background: color }}
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.25, delay, ease: 'easeOut' }}
      />
    </div>
  );
}

/** Multi-segment bar scaled against `max` (so rows in a list are comparable). */
export function StackedBar({ parts, max, label }: { parts: Array<{ value: number; color: string; name: string }>; max: number; label: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${label}: ${parts.map((p) => `${p.name} ${p.value}`).join(', ')}`}>
      {parts.filter((p) => p.value > 0).map((p) => (
        <motion.div key={p.name} className="h-full origin-left" style={{ width: `${(p.value / (max || 1)) * 100}%`, background: p.color }} initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.25, ease: 'easeOut' }} />
      ))}
    </div>
  );
}

export function Legend({ items }: { items: Array<{ name: string; color: string }> }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => <li key={i.name} className="flex items-center gap-1.5"><i className="size-2 rounded-sm" style={{ background: i.color }} aria-hidden />{i.name}</li>)}
    </ul>
  );
}
