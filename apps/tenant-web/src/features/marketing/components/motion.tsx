'use client';

import * as React from 'react';
import { animate, motion, useInView, useReducedMotion, useScroll, useSpring } from 'framer-motion';

/** Fades and lifts its children in the first time they scroll into view. No motion for reduced-motion users. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  as = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  /** Use 'li' inside a list so the markup stays valid. */
  as?: 'div' | 'li';
}) {
  const reduce = useReducedMotion();
  const Plain = as;
  const Animated = as === 'li' ? motion.li : motion.div;
  if (reduce) return <Plain className={className}>{children}</Plain>;
  return (
    <Animated
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Animated>
  );
}

/** Counts up to `to` once visible. Under reduced motion it just shows the final number. */
export function CountUp({
  to,
  prefix = '',
  suffix = '',
  duration = 1.6,
  format,
  className,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const fmt = React.useCallback((n: number) => (format ? format(n) : Math.round(n).toLocaleString('en-IN')), [format]);
  const [value, setValue] = React.useState(reduce ? to : 0);

  React.useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setValue(to);
      return;
    }
    const controls = animate(0, to, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setValue(v) });
    return () => controls.stop();
  }, [inView, reduce, to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {fmt(value)}
      {suffix}
    </span>
  );
}

/** A thin orange to cyan bar across the top that fills as the page scrolls. */
export function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.3 });
  if (reduce) return null;
  return <motion.div aria-hidden style={{ scaleX }} className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-gradient-to-r from-orange-500 via-orange-400 to-cyan-400" />;
}

/** Soft drifting colour blobs behind a section. Static for reduced-motion users. */
export function Blobs({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const drift = (x: number, y: number, d: number) => (reduce ? undefined : { x: [0, x, 0], y: [0, y, 0], transition: { duration: d, repeat: Infinity, ease: 'easeInOut' as const } });
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className ?? ''}`}>
      <motion.div animate={drift(40, 30, 14)} className="absolute -left-24 top-0 size-[26rem] rounded-full bg-orange-500/15 blur-3xl dark:bg-orange-500/20" />
      <motion.div animate={drift(-50, 40, 17)} className="absolute -right-24 top-1/3 size-[28rem] rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-400/15" />
    </div>
  );
}
