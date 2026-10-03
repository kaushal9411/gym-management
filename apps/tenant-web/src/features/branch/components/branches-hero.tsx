'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';

import { accentVar, type Accent } from '@/features/members/components/detail/detail-ui';
import type { BranchDetail } from '../types';

const FACE_TONES: Accent[] = ['primary', 'violet', 'aqua', 'destructive', 'warning', 'success'];

interface BranchesHeroProps {
  total: number;
  branches: BranchDetail[];
  actions: React.ReactNode;
}

/** Same gradient-hero pattern as `StaffHero`/`MembersHero` — visual only. */
export function BranchesHero({ total, branches, actions }: BranchesHeroProps) {
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
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Locations</p>
        <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl">Branches</h1>
        <p className="mt-1 text-white/85">Manage every location your gym operates from.</p>
        {branches.length > 0 ? (
          <div className="mt-3.5 flex flex-wrap items-center">
            {branches.slice(0, 6).map((b, i) => (
              <motion.span key={b.id} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 * i }} className="-ml-2 first:ml-0">
                <span
                  className="flex size-[34px] items-center justify-center rounded-full border-2 border-white/90 text-[11px] font-extrabold text-white"
                  style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(FACE_TONES[i % FACE_TONES.length]!)}, var(--chart-7))` }}
                >
                  <Building2 className="size-3.5" aria-hidden />
                </span>
              </motion.span>
            ))}
            {total > branches.length ? <em className="ml-3 text-sm font-semibold not-italic text-white/90">+{total - Math.min(branches.length, 6)} more</em> : null}
          </div>
        ) : null}
      </div>
      <div className="relative flex flex-wrap items-center gap-2 [&_button]:border-white/30 [&_button]:bg-white/15 [&_button]:text-white [&_button:hover]:bg-white/25 [&_a]:border-white/30">
        {actions}
      </div>
    </motion.section>
  );
}
