'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { AUTH_ROUTES } from '@/features/auth/constants';
import { CTA_PHOTO } from '../images';
import { Reveal } from './motion';
import { Photo } from './photo';

export function CtaBand({ name }: { name: string }) {
  const reduce = useReducedMotion();
  return (
    <section className="px-4 pb-8 pt-4 sm:px-6">
      <Reveal>
        <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-foreground/10 bg-[#1a0f08] px-6 py-16 text-center text-white sm:px-12 sm:py-20">
          <motion.div
            aria-hidden
            className="absolute inset-0 -z-20"
            initial={reduce ? false : { scale: 1.18 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <Photo photo={CTA_PHOTO} sizes="100vw" />
          </motion.div>
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-orange-600/85 via-[#1a0f08]/75 to-[#1a0f08]/90" />
          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-black tracking-tight sm:text-4xl">Ready to run your gym on {name}?</h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-base font-medium text-white/85">Register in a few minutes. Already have an account? Log in and carry on where you left off.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={AUTH_ROUTES.register}
              className="group inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 px-6 text-base font-bold text-[#1a0f08] outline-none transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-white active:scale-[0.98]"
            >
              Register your gym
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link
              href={AUTH_ROUTES.login}
              className="inline-flex h-12 items-center rounded-xl border-2 border-white/70 px-6 text-base font-bold text-white outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"
            >
              Login
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
