'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { HERO_PHOTOS } from '../images';
import { Photo } from './photo';

/**
 * Full-height photo on the right of the hero. The photos cross-fade every few seconds while each one
 * slowly zooms and drifts (the "Ken Burns" move). It fades into the page on the left and bottom so the
 * headline stays readable, and the dashboard floats on top of it.
 */
export function HeroBackdrop() {
  const reduce = useReducedMotion();
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % HERO_PHOTOS.length), 5500);
    return () => window.clearInterval(id);
  }, [reduce]);

  const drift = [
    { from: { scale: 1.02, x: 0, y: 0 }, to: { scale: 1.14, x: -24, y: -10 } },
    { from: { scale: 1.12, x: -20, y: 6 }, to: { scale: 1.02, x: 8, y: 0 } },
    { from: { scale: 1.02, x: 10, y: -6 }, to: { scale: 1.13, x: -14, y: 8 } },
    { from: { scale: 1.1, x: 0, y: 10 }, to: { scale: 1.02, x: -10, y: 0 } },
  ];
  const photo = HERO_PHOTOS[i]!;
  const d = drift[i % drift.length]!;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-[62%] overflow-hidden opacity-[0.55] [mask-image:linear-gradient(to_left,#000_35%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_left,#000_35%,transparent_100%)] dark:opacity-60 lg:block"
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={photo.src}
          className="absolute inset-0"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 1.4, ease: 'easeInOut' }}
        >
          <motion.div
            className="absolute inset-0"
            initial={reduce ? false : d.from}
            animate={reduce ? undefined : d.to}
            transition={{ duration: 7.5, ease: 'linear' }}
          >
            <Photo photo={photo} priority={i === 0} sizes="62vw" />
          </motion.div>
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/15 via-transparent to-cyan-400/15 mix-blend-overlay" />
    </div>
  );
}
