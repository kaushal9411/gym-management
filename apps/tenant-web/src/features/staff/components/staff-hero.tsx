'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { accentVar, type Accent } from '@/features/members/components/detail/detail-ui';
import type { StaffListItem } from '../types';

const FACE_TONES: Accent[] = ['primary', 'violet', 'aqua', 'destructive', 'warning', 'success'];

interface StaffHeroProps {
  total: number;
  faces: StaffListItem[];
  actions: React.ReactNode;
}

/** Same gradient-hero pattern as `MembersHero`/`IamHero` — visual only, no behavior of its own. */
export function StaffHero({ total, faces, actions }: StaffHeroProps) {
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
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Team</p>
        <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl">Staff</h1>
        <p className="mt-1 text-white/85">Managers, trainers, and receptionists at your gym.</p>
        {faces.length > 0 ? (
          <div className="mt-3.5 flex flex-wrap items-center">
            {faces.slice(0, 6).map((s, i) => (
              <motion.span key={s.id} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 * i }} className="-ml-2 first:ml-0">
                <Avatar className="size-[34px] border-2 border-white/90">
                  {s.avatarUrl ? <AvatarImage src={s.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="text-[11px] font-extrabold text-white" style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(FACE_TONES[i % FACE_TONES.length]!)}, var(--chart-7))` }}>
                    {s.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </motion.span>
            ))}
            {total > faces.length ? <em className="ml-3 text-sm font-semibold not-italic text-white/90">+{total - Math.min(faces.length, 6)} more</em> : null}
          </div>
        ) : null}
      </div>
      <div className="relative flex flex-wrap items-center gap-2 [&_button]:border-white/30 [&_button]:bg-white/15 [&_button]:text-white [&_button:hover]:bg-white/25 [&_a]:border-white/30">
        {actions}
      </div>
    </motion.section>
  );
}
