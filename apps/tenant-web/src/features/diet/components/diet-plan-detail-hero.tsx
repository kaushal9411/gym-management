'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Apple, Flame, Target, UserCog, Users } from 'lucide-react';

import type { DietPlanDetail } from '../types';

interface DietPlanDetailHeroProps {
  data: DietPlanDetail;
  /** The existing Duplicate / Activate / Deactivate / Restore / Delete buttons — passed through untouched so their permission logic stays on the page. */
  actions: React.ReactNode;
}

const ACTION_SKIN =
  'contents [&_button:not(.bg-destructive)]:border [&_button:not(.bg-destructive)]:border-white/30 [&_button:not(.bg-destructive)]:bg-white/15 [&_button:not(.bg-destructive)]:text-white [&_button:not(.bg-destructive):hover]:bg-white/25';

/** Same gradient-hero pattern as `WorkoutPlanDetailHero`/`BranchDetailHero` — an apple icon in place of an avatar, calories/duration/trainer/members in place of contact info. */
export function DietPlanDetailHero({ data, actions }: DietPlanDetailHeroProps) {
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
            <span className="grid size-20 place-items-center rounded-full bg-indigo-950/85">
              <Apple className="size-8" aria-hidden />
            </span>
          </motion.div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">{data.name}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-white/80">
              <Target className="size-3.5" aria-hidden /> {data.goal ?? 'No goal set'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1 backdrop-blur">
                <span className={`size-2 rounded-full ${data.deletedAt ? 'bg-rose-300' : data.isActive ? 'bg-emerald-300 shadow-[0_0_0_3px_rgba(110,231,183,.35)]' : 'bg-amber-300'}`} aria-hidden />
                {data.deletedAt ? 'Deleted' : data.isActive ? 'Active' : 'Inactive'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 backdrop-blur">
                {data.durationDays}d
              </span>
              {data.dailyCalories ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 backdrop-blur">
                  <Flame className="size-3.5" aria-hidden /> {data.dailyCalories} kcal/day
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 backdrop-blur">
                <Users className="size-3.5" aria-hidden /> {data.activeMemberCount} active member(s)
              </span>
              {data.trainer ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 backdrop-blur">
                  <UserCog className="size-3.5" aria-hidden /> {data.trainer.name}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className={ACTION_SKIN}>{actions}</div>
        </div>
      </div>
    </motion.section>
  );
}
