'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { BadgeIndianRupee, ClipboardList, Crown, Dumbbell, HeartPulse, UserCog, type LucideIcon } from 'lucide-react';

import { Ring } from './charts';
import { SectionHead } from './content-sections';
import { CountUp, Reveal } from './motion';

const ROLES: Array<{ icon: LucideIcon; name: string; body: string }> = [
  { icon: Crown, name: 'Owner', body: 'Revenue, branches, staff and reports across the whole gym.' },
  { icon: UserCog, name: 'Manager', body: 'Run a branch day to day: members, plans, classes, payments.' },
  { icon: ClipboardList, name: 'Receptionist', body: 'Check members in, sign them up and take payments at the desk.' },
  { icon: Dumbbell, name: 'Trainer', body: 'Assign workouts and diets and follow each member’s progress.' },
  { icon: HeartPulse, name: 'Member', body: 'Plan, payments, workouts, diet and class booking in one app.' },
];

/** A phone showing the member app. The numbers are sample data. */
function PhoneMock() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      animate={reduce ? undefined : { y: [0, -10, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      className="relative mx-auto w-[17rem] rounded-[2.6rem] border-[7px] border-foreground/85 bg-background p-3 shadow-2xl dark:border-foreground/30"
    >
      <span aria-hidden className="absolute left-1/2 top-2 h-4 w-20 -translate-x-1/2 rounded-full bg-foreground/85 dark:bg-foreground/30" />
      <div className="mt-5 space-y-2.5">
        <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 p-3.5 text-[#1a0f08]">
          <p className="text-[11px] font-semibold opacity-80">Your plan</p>
          <p className="text-lg font-extrabold">Monthly</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20">
            <motion.div className="h-full rounded-full bg-[#1a0f08]" initial={{ width: 0 }} whileInView={{ width: '68%' }} viewport={{ once: true }} transition={{ duration: 1.2, delay: 0.3 }} />
          </div>
          <p className="mt-1 text-[11px] font-semibold">21 days left</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-2.5">
            <Ring value={0.75} size={62} thickness={8} className="text-cyan-500"><span className="text-[11px] font-extrabold text-foreground"><CountUp to={75} suffix="%" /></span></Ring>
            <p className="mt-1 text-[11px] font-semibold text-foreground/70">Workout week</p>
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-2.5">
            <Ring value={0.64} size={62} thickness={8} className="text-orange-500"><span className="text-[11px] font-extrabold text-foreground"><CountUp to={64} suffix="%" /></span></Ring>
            <p className="mt-1 text-[11px] font-semibold text-foreground/70">Calories</p>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-3">
          <div>
            <p className="text-[11px] text-foreground/55">Next class</p>
            <p className="text-sm font-bold text-foreground">HIIT · 6:30 pm</p>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Booked</span>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-3 text-[11px] text-foreground/70">
          <BadgeIndianRupee className="size-4 text-orange-500" aria-hidden /> No payments due
        </div>
      </div>
    </motion.div>
  );
}

export function AppsSection() {
  return (
    <section className="relative border-t border-foreground/10 py-20 sm:py-28" aria-labelledby="apps-title">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <SectionHead align="left" eyebrow="Apps for everyone" title="One platform, five apps" body="Each person gets an Android app built around what they do every day, so nobody wades through screens that are not theirs." />
          <h2 id="apps-title" className="sr-only">Apps for everyone</h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {ROLES.map((r, i) => (
              <Reveal as="li" key={r.name} delay={i * 0.06} y={18} className="group flex h-full gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-500/40 hover:bg-foreground/[0.06]">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-500/15 text-orange-600 transition-transform duration-300 group-hover:scale-110 dark:text-orange-300">
                  <r.icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-bold text-foreground">{r.name}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-foreground/60">{r.body}</span>
                </span>
              </Reveal>
            ))}
          </ul>
        </div>
        <div>
          <PhoneMock />
          <p className="mt-6 text-center text-[11px] font-semibold uppercase tracking-wider text-foreground/40">Member app · Sample data</p>
        </div>
      </div>
    </section>
  );
}
