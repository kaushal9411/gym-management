'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { accentVar, type Accent } from '@/features/members/components/detail/detail-ui';
import type { MeasuredMember } from '../types';

const FACE_TONES: Accent[] = ['primary', 'violet', 'aqua', 'destructive', 'warning', 'success'];

interface MeasurementsHeroProps {
  total: number;
  members: MeasuredMember[];
  actions: React.ReactNode;
}

/** Same gradient-hero pattern as `MembersHero` — a real member facepile in place of a module-icon one, since this list is fundamentally a member roster. */
export function MeasurementsHero({ total, members, actions }: MeasurementsHeroProps) {
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
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Progress</p>
        <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl">Body Measurements</h1>
        <p className="mt-1 text-white/85">Members with a recorded measurement history.</p>
        {members.length > 0 ? (
          <div className="mt-3.5 flex items-center">
            {members.slice(0, 6).map((m, i) => (
              <motion.span key={m.member.id} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 * i }} className="-ml-2 first:ml-0">
                <Avatar className="size-[34px] border-2 border-white/90">
                  {m.member.profilePhotoUrl ? <AvatarImage src={m.member.profilePhotoUrl} alt="" /> : null}
                  <AvatarFallback className="text-[11px] font-extrabold text-white" style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(FACE_TONES[i % FACE_TONES.length]!)}, var(--chart-7))` }}>
                    {m.member.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </motion.span>
            ))}
            {total > members.length ? <em className="ml-3 text-sm font-semibold not-italic text-white/90">+{total - Math.min(members.length, 6)} more</em> : null}
          </div>
        ) : null}
      </div>
      <div className="relative flex flex-wrap items-center gap-2 [&_button]:border-white/30 [&_button]:bg-white/15 [&_button]:text-white [&_button:hover]:bg-white/25 [&_a]:border-white/30">
        {actions}
      </div>
    </motion.section>
  );
}
