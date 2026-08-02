'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Presentational loader card — spring-animated progress ring + a barbell
 * that racks up plates as `progress` climbs, cycling tip text underneath.
 * Purely presentational: takes `progress` (0-100) and an optional `label`
 * as props, no store/context reads. `GlobalLoader` is the container that
 * wires this to the app's actual loading state — see that file to change
 * WHEN this shows; edit this file to change what it looks like.
 */

const TIPS = ['racking up your data', 'syncing member check-ins', 'loading class schedules', 'checking equipment status', 'almost there'];

const PLATE_COUNT = 6;

interface GymLoaderProps {
  /** 0-100. */
  progress: number;
  label?: string;
}

export function GymLoader({ progress, label }: GymLoaderProps) {
  const clamped = Math.max(0, Math.min(100, progress));
  const platesOn = Math.round((clamped / 100) * PLATE_COUNT);
  const tipIndex = Math.min(TIPS.length - 1, Math.floor((clamped / 100) * TIPS.length));
  const circumference = 2 * Math.PI * 65;
  const ringOffset = circumference - (clamped / 100) * circumference;

  return (
    <div style={styles.card}>
      <div style={styles.ringWrap}>
        <svg width={150} height={150} viewBox="0 0 150 150" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="75" cy="75" r="65" fill="none" stroke="#2A2D33" strokeWidth="8" />
          <motion.circle
            cx="75"
            cy="75"
            r="65"
            fill="none"
            stroke="#C6FF3D"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={false}
            animate={{ strokeDashoffset: ringOffset }}
            transition={{ type: 'spring', stiffness: 90, damping: 18 }}
          />
        </svg>

        <div style={styles.center}>
          <div style={styles.barbell}>
            <div style={styles.bar} />
            <div style={{ ...styles.plateRow, justifyContent: 'flex-end' }}>
              {Array.from({ length: PLATE_COUNT / 2 }).map((_, i) => (
                <PlateSVG key={`l-${i}`} on={platesOn > PLATE_COUNT / 2 - 1 - i} />
              ))}
            </div>
            <div style={styles.plateRow}>
              {Array.from({ length: PLATE_COUNT / 2 }).map((_, i) => (
                <PlateSVG key={`r-${i}`} on={platesOn > PLATE_COUNT / 2 + i} />
              ))}
            </div>
          </div>

          <motion.div
            key={Math.round(clamped)}
            initial={{ opacity: 0.4, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={styles.pct}
          >
            {Math.round(clamped)}%
          </motion.div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tipIndex}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          style={styles.status}
        >
          {clamped >= 100 ? 'ready' : TIPS[tipIndex]}
        </motion.div>
      </AnimatePresence>

      {label ? <div style={styles.label}>{label}</div> : null}
    </div>
  );
}

function PlateSVG({ on }: { on: boolean }) {
  return (
    <motion.div
      initial={false}
      animate={{ scaleY: on ? 1 : 0, opacity: on ? 1 : 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 16 }}
      style={styles.plate}
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    width: 'fit-content',
  },
  ringWrap: {
    position: 'relative',
    width: 150,
    height: 150,
  },
  center: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  barbell: {
    position: 'relative',
    width: 90,
    height: 20,
    display: 'flex',
    alignItems: 'center',
  },
  bar: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '70%',
    height: 5,
    borderRadius: 3,
    background: 'linear-gradient(180deg, #565A63, #2A2D33)',
  },
  plateRow: {
    display: 'flex',
    gap: 3,
    width: '50%',
    zIndex: 1,
  },
  plate: {
    width: 8,
    height: 26,
    borderRadius: 3,
    background: '#1c2113',
    border: '1.5px solid #C6FF3D',
    transformOrigin: 'center',
  },
  pct: {
    fontSize: 22,
    fontWeight: 800,
    color: '#F5F4EF',
    letterSpacing: 0.5,
  },
  status: {
    fontSize: 17,
    fontWeight: 700,
    color: '#E4E2DA',
    textAlign: 'center',
    minHeight: 20,
  },
  label: {
    fontSize: 12,
    color: '#565A63',
    textAlign: 'center',
  },
};
