'use client';

import * as React from 'react';
import { useReducedMotion, type Transition, type Variants } from 'framer-motion';

/** Shared easing curve (matches `ProgressBar` in detail-ui). */
export const EASE = [0.2, 0.8, 0.2, 1] as const;
/** Stagger never spans more than this many items — later items share the last delay. */
export const STAGGER_CAP = 12;

const base: Transition = { duration: 0.45, ease: EASE };

/** Parent variants: children using `fadeUp`/`scaleIn`/`listItem` cascade by `delay` seconds (capped via `STAGGER_CAP`). */
export const staggerContainer = (delay = 0.06, delayChildren = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delay, delayChildren } },
});

export const fadeUp: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: base } };
export const scaleIn: Variants = { hidden: { opacity: 0, scale: 0.94 }, show: { opacity: 1, scale: 1, transition: base } };
export const listItem: Variants = { hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: EASE } } };
/** Route-level enter/exit — use as `variants` with `initial="hidden" animate="show" exit="exit"`. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.2 } },
};

/** Per-index delay in seconds, capped so long lists don't take seconds to appear. */
export const staggerDelay = (index: number, step = 0.05, cap = STAGGER_CAP): number => Math.min(index, cap) * step;

const NOOP: Variants = { hidden: {}, show: {}, exit: {} };

export interface MotionSafe {
  reduce: boolean;
  staggerContainer: (delay?: number, delayChildren?: number) => Variants;
  fadeUp: Variants;
  scaleIn: Variants;
  listItem: Variants;
  pageTransition: Variants;
  /** `false` when reduced motion is on (skips the entrance), otherwise `'hidden'`. */
  initial: 'hidden' | false;
}

/** Returns the shared variants, or no-op variants when `prefers-reduced-motion` is set. */
export function useMotionSafe(): MotionSafe {
  const reduce = useReducedMotion() ?? false;
  return React.useMemo<MotionSafe>(
    () =>
      reduce
        ? { reduce, staggerContainer: () => NOOP, fadeUp: NOOP, scaleIn: NOOP, listItem: NOOP, pageTransition: NOOP, initial: false }
        : { reduce, staggerContainer, fadeUp, scaleIn, listItem, pageTransition, initial: 'hidden' },
    [reduce],
  );
}
