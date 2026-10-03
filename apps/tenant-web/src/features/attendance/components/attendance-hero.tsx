'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

interface AttendanceHeroProps {
  currentlyInside: number;
  loading?: boolean;
  actions: React.ReactNode;
}

/** Same gradient-hero pattern as `MembersHero`/`BranchesHero` — a live "currently inside" readout (pulsing dot) in place of a facepile. */
export function AttendanceHero({ currentlyInside, loading, actions }: AttendanceHeroProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative grid gap-5 overflow-hidden rounded-3xl p-6 text-white shadow-lg lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-7"
      style={{ backgroundImage: 'radial-gradient(900px 320px at 88% -30%, color-mix(in oklch, #c026d3 75%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
      <div className="relative min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Live</p>
        <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl">Attendance</h1>
        <p className="mt-1 text-white/85">Who&apos;s checked in, and how the gym trends over time.</p>
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="mt-4 inline-flex items-center gap-3 rounded-2xl border border-white/25 bg-white/15 px-4 py-2.5 backdrop-blur"
        >
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-300" />
          </span>
          <span className="text-2xl font-extrabold tabular-nums">{loading ? '—' : currentlyInside}</span>
          <span className="text-sm font-medium text-white/80">currently inside</span>
        </motion.div>
      </div>
      <div className="relative flex flex-wrap items-center gap-2 [&_button]:border-white/30 [&_button]:bg-white/15 [&_button]:text-white [&_button:hover]:bg-white/25 [&_a]:border-white/30">
        {actions}
      </div>
    </motion.section>
  );
}
