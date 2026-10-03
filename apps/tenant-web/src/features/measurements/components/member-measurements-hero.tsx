'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Building2, ListChecks, Scale, UserCog } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { BodyMeasurement } from '../types';

interface MemberMeasurementsHeroProps {
  name: string;
  memberId: string;
  profilePhotoUrl: string | null;
  branchName: string;
  trainerName: string | null;
  latest: BodyMeasurement | null;
  entryCount: number;
  actions?: React.ReactNode;
}

/** Same gradient-hero pattern as every detail page — a real member avatar in place of a module icon, latest weight/body-fat/entry-count in place of contact info. */
export function MemberMeasurementsHero({ name, memberId, profilePhotoUrl, branchName, trainerName, latest, entryCount, actions }: MemberMeasurementsHeroProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative grid gap-6 overflow-hidden rounded-3xl p-6 text-white shadow-lg lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-7"
      style={{
        backgroundImage:
          'radial-gradient(900px 300px at 85% -20%, color-mix(in oklch, #c026d3 75%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }}
      />
      <div className="relative min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-5">
          <motion.div
            initial={{ opacity: 0, rotate: -80, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
            className="rounded-full p-1"
            style={{ backgroundImage: 'conic-gradient(from 210deg, #fde68a, #f9a8d4, #a5b4fc, #6ee7b7, #fde68a)' }}
          >
            <Avatar className="size-20 border-4 border-indigo-950/20">
              {profilePhotoUrl ? <AvatarImage src={profilePhotoUrl} alt="" /> : null}
              <AvatarFallback className="bg-indigo-950/85 text-2xl font-extrabold text-white">
                {name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </motion.div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">{name}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-white/80">
              <Building2 className="size-3.5" aria-hidden /> {memberId || 'No member ID'} · {branchName}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
              {latest?.weightKg ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1 backdrop-blur">
                  <Scale className="size-3.5" aria-hidden /> {latest.weightKg} kg
                </span>
              ) : null}
              {latest?.bodyFatPercent ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 backdrop-blur">
                  {latest.bodyFatPercent}% body fat
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 backdrop-blur">
                <ListChecks className="size-3.5" aria-hidden /> {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
              </span>
              {trainerName ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 backdrop-blur">
                  <UserCog className="size-3.5" aria-hidden /> {trainerName}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </motion.section>
  );
}
