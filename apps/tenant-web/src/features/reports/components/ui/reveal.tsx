'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

import { useMotionSafe } from '../../lib/motion';

/** In-view fade-up wrapper (plays once); `delay` in seconds. */
export function Reveal({ children, delay = 0, className, id }: { children: React.ReactNode; delay?: number; className?: string; id?: string }) {
  const m = useMotionSafe();
  return (
    <motion.div
      id={id}
      className={className}
      variants={m.fadeUp}
      initial={m.initial}
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={delay ? { delay } : undefined}
    >
      {children}
    </motion.div>
  );
}

/** In-view container whose `StaggerItem`/`KpiTile` children cascade in; `step` = seconds between items. */
export function StaggerGroup({ children, step = 0.06, className }: { children: React.ReactNode; step?: number; className?: string }) {
  const m = useMotionSafe();
  return (
    <motion.div className={className} variants={m.staggerContainer(step)} initial={m.initial} whileInView="show" viewport={{ once: true, margin: '0px 0px -8% 0px' }}>
      {children}
    </motion.div>
  );
}

/** Child of `StaggerGroup`; renders plain (no animation) outside one. */
export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const m = useMotionSafe();
  return (
    <motion.div className={className} variants={m.fadeUp}>
      {children}
    </motion.div>
  );
}
