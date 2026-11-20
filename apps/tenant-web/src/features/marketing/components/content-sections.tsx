'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Plus } from 'lucide-react';

import { FAQ_ITEMS, STEPS } from '../constants';
import { Reveal } from './motion';

export function SectionHead({ eyebrow, title, body, align = 'center' }: { eyebrow: string; title: string; body?: string; align?: 'center' | 'left' }) {
  const left = align === 'left';
  return (
    <Reveal className={left ? 'max-w-xl' : 'mx-auto max-w-2xl text-center'}>
      <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-300">
        <span aria-hidden className="h-px w-6 bg-gradient-to-r from-orange-500 to-cyan-400" />
        {eyebrow}
      </p>
      <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{title}</h2>
      {body ? <p className="mt-4 text-pretty text-base leading-relaxed text-foreground/65">{body}</p> : null}
    </Reveal>
  );
}

export function StepsSection() {
  const reduce = useReducedMotion();
  return (
    <section className="relative border-t border-foreground/10 py-20 sm:py-28" aria-labelledby="steps-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead eyebrow="Getting started" title="Live in three steps" />
        <h2 id="steps-title" className="sr-only">Getting started</h2>
        <div className="relative mt-14">
          <motion.div
            aria-hidden
            className="absolute left-[16.6%] right-[16.6%] top-6 hidden h-0.5 origin-left bg-gradient-to-r from-orange-500 via-orange-400 to-cyan-400 md:block"
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          />
          <ol className="grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.15} className="relative text-center md:px-4">
                <span className="relative z-10 mx-auto grid size-12 place-items-center rounded-full bg-gradient-to-br from-orange-500 to-cyan-400 text-lg font-black text-[#1a0f08] shadow-lg">{i + 1}</span>
                <h3 className="mt-5 text-lg font-bold text-foreground">
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.title}
                </h3>
                <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-foreground/65">{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-20 border-t border-foreground/10 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHead eyebrow="FAQ" title="Questions gym owners ask" />
        <div className="mt-10 space-y-3">
          {FAQ_ITEMS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={i * 0.04} y={14}>
                <div className={`overflow-hidden rounded-2xl border transition-colors duration-300 ${isOpen ? 'border-orange-500/40 bg-foreground/[0.05]' : 'border-foreground/10 bg-foreground/[0.03] hover:border-foreground/25'}`}>
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`faq-${i}`}
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {f.q}
                      <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.25 }} className="grid size-7 shrink-0 place-items-center rounded-full border border-foreground/20 text-foreground/70">
                        <Plus className="size-4" aria-hidden />
                      </motion.span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        id={`faq-${i}`}
                        role="region"
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={reduce ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <p className="px-5 pb-5 text-sm leading-relaxed text-foreground/65">{f.a}</p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function Tick({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-foreground/75">
      <Check className="mt-0.5 size-4 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
