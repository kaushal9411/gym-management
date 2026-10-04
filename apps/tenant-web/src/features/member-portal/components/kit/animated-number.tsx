'use client';

import * as React from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/**
 * Count-up number (member-plane safe: no staff hooks). `format` maps the
 * animated number to text (default: rounded, locale grouped). Pass
 * `usePortalMoney().format` for money. Reduced motion renders instantly.
 */
export function AnimatedNumber({ value, format, duration = 0.9, className }: { value: number; format?: (n: number) => string; duration?: number; className?: string }) {
  const reduce = useReducedMotion();
  const fmt = React.useCallback((n: number) => (format ? format(n) : Math.round(n).toLocaleString()), [format]);
  const fmtRef = React.useRef(fmt);
  fmtRef.current = fmt;
  const ref = React.useRef<HTMLSpanElement>(null);
  const from = React.useRef(0);
  React.useEffect(() => {
    const el = ref.current;
    if (reduce || !el) {
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        el.textContent = fmtRef.current(v);
      },
      onComplete: () => {
        from.current = value;
      },
    });
    return () => {
      controls.stop();
      from.current = value;
    };
  }, [value, reduce, duration]);
  return (
    <span ref={ref} className={className}>
      {fmt(value)}
    </span>
  );
}
