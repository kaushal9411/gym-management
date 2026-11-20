'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';

import { AUTH_ROUTES } from '@/features/auth/constants';
import { DashboardPreview } from './dashboard-preview';
import { HeroBackdrop } from './hero-backdrop';

const WORDS = ['Run your gym.', 'Get paid on time.'];

export function HeroSection({ name }: { name: string }) {
  const reduce = useReducedMotion();
  const rise = (i: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 26 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: 0.1 + i * 0.12, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="home-glow absolute inset-0 -z-10" />
      <HeroBackdrop />
      <div aria-hidden className="home-grid absolute inset-0 -z-10" />
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-24 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_1.05fr] lg:gap-10 lg:pb-32">
        <div>
          <motion.p {...rise(0)} className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-200">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan-500 opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-cyan-500" />
            </span>
            Gym management software
          </motion.p>

          <h1 className="mt-5 text-balance text-4xl font-black leading-[1.04] tracking-tight text-foreground sm:text-5xl lg:text-[3.6rem]">
            <motion.span {...rise(1)} className="block">{WORDS[0]}</motion.span>
            <motion.span {...rise(2)} className="home-shimmer block bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 bg-clip-text text-transparent dark:from-orange-400 dark:via-orange-300 dark:to-cyan-300">
              {WORDS[1]}
            </motion.span>
          </h1>

          <motion.p {...rise(3)} className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-foreground/70 sm:text-lg">
            {name} keeps members, attendance, classes, workouts and billing in one place, with apps for your owners, trainers and members. Invoices go out, reminders follow up and payments land where you can see them.
          </motion.p>

          <motion.div {...rise(4)} className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={AUTH_ROUTES.register}
              className="group inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 px-6 text-base font-bold text-[#1a0f08] shadow-[0_10px_34px_-8px_rgba(255,106,53,0.75)] outline-none transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-8px_rgba(255,106,53,0.85)] focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0 active:scale-[0.98]"
            >
              Register your gym
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link
              href={AUTH_ROUTES.login}
              className="inline-flex h-12 items-center rounded-xl border border-foreground/25 px-6 text-base font-semibold text-foreground outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
            >
              Login
            </Link>
            <a href="#contact" className="inline-flex h-12 items-center rounded-xl px-3 text-base font-semibold text-cyan-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring dark:text-cyan-200">
              Talk to sales
            </a>
          </motion.div>

          <motion.ul {...rise(5)} className="mt-8 grid gap-2 text-sm text-foreground/65 sm:grid-cols-2">
            {['Set up in a few minutes', 'Android apps for staff and members', 'Invoices, GST and online payments', 'Reminders by push, email, SMS, WhatsApp'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                  <Check className="size-3" aria-hidden />
                </span>
                {t}
              </li>
            ))}
          </motion.ul>
        </div>

        <DashboardPreview />
      </div>
    </section>
  );
}
