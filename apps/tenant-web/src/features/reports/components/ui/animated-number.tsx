'use client';

import * as React from 'react';
import { animate, useReducedMotion } from 'framer-motion';

import { useCurrencySymbol } from '@/lib/currency';
import { formatValue, type ValueFormat } from '../../lib/format';

/** Count-up number: `format` is a `ValueFormat` or a custom `(n)=>string`; reduced motion renders the final value immediately. */
export function AnimatedNumber({
  value,
  format = 'number',
  compact,
  duration = 0.9,
  className,
}: {
  value: number;
  format?: ValueFormat | ((n: number) => string);
  compact?: boolean;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const symbol = useCurrencySymbol();
  const fmt = React.useCallback((n: number) => (typeof format === 'function' ? format(n) : formatValue(format, n, symbol, compact)), [format, symbol, compact]);
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
