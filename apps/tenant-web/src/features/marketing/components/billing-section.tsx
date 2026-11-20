'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';

import { BILLING_FEATURES } from '../constants';
import { BarChart, Donut } from './charts';
import { SectionHead } from './content-sections';
import { CountUp, Reveal } from './motion';

const FLOW = [
  ['A plan is sold or renewed', 'The member gets a numbered invoice with tax and any discount applied.'],
  ['The member pays', 'At the desk, or online through the app or a payment link.'],
  ['It is matched and recorded', 'The invoice is marked paid, a receipt is available and your income report updates.'],
  ['If it is late, they are reminded', 'Reminders go out by push, email or SMS until the invoice is settled.'],
] as const;

const ITEMS: Array<[string, string]> = [
  ['Monthly plan', '₹2,118.64'],
  ['Joining fee', '₹381.36'],
];

/** The flow on the left and the invoice on the right move together: step 2 is when the invoice flips to Paid. */
function useStep(count: number, ms: number) {
  const reduce = useReducedMotion();
  const [step, setStep] = React.useState(reduce ? count - 1 : 0);
  React.useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % count), ms);
    return () => window.clearInterval(id);
  }, [reduce, count, ms]);
  return [step, setStep] as const;
}

export function BillingSection() {
  const [step, setStep] = useStep(FLOW.length, 2800);
  const paid = step >= 2 && step !== 3;
  const late = step === 3;

  return (
    <section id="billing" className="relative scroll-mt-20 overflow-hidden border-t border-foreground/10 py-20 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute -right-40 top-10 size-[30rem] rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead eyebrow="Billing" title="From invoice to payment, without chasing" body="Members see what they owe and can pay in the app. You see what has been paid, what is due and what is overdue." />

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-[1fr_1.05fr]">
          <Reveal>
            <ol className="relative space-y-1 rounded-3xl border border-foreground/10 bg-card p-5 sm:p-7">
              <span aria-hidden className="absolute bottom-12 left-[2.95rem] top-12 w-0.5 bg-foreground/10 sm:left-[3.45rem]" />
              <motion.span
                aria-hidden
                className="absolute left-[2.95rem] top-12 w-0.5 origin-top bg-gradient-to-b from-orange-500 to-cyan-400 sm:left-[3.45rem]"
                animate={{ height: `${(step / (FLOW.length - 1)) * (100 - 24)}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                style={{ maxHeight: 'calc(100% - 6rem)' }}
              />
              {FLOW.map(([t, b], i) => {
                const done = i <= step;
                return (
                  <li key={t}>
                    <button type="button" onClick={() => setStep(i)} className="relative flex w-full gap-4 rounded-2xl p-3 text-left outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-ring">
                      <motion.span
                        animate={{ scale: i === step ? 1.12 : 1 }}
                        className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-sm font-black transition-colors duration-300 ${done ? 'bg-gradient-to-br from-orange-500 to-cyan-400 text-[#1a0f08]' : 'bg-foreground/10 text-foreground/50'}`}
                      >
                        {i < step ? <Check className="size-4" aria-hidden /> : i + 1}
                      </motion.span>
                      <span>
                        <span className={`block font-semibold transition-colors ${done ? 'text-foreground' : 'text-foreground/55'}`}>{t}</span>
                        <span className="mt-0.5 block text-sm leading-relaxed text-foreground/60">{b}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="h-full rounded-3xl border border-foreground/12 bg-card p-5 shadow-xl sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/40">Invoice · Sample data</p>
                  <p className="mt-1 text-lg font-extrabold text-foreground">INV-1042</p>
                  <p className="text-xs text-foreground/55">Aarav K. · Monthly plan</p>
                </div>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={paid ? 'paid' : late ? 'late' : 'due'}
                    initial={{ opacity: 0, scale: 0.7, rotate: -6 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${paid ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : late ? 'bg-red-500/15 text-red-700 dark:text-red-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}
                  >
                    {paid ? 'Paid' : late ? 'Overdue' : 'Unpaid'}
                  </motion.span>
                </AnimatePresence>
              </div>

              <ul className="mt-4 divide-y divide-foreground/10 text-sm">
                {ITEMS.map(([n, v]) => (
                  <li key={n} className="flex justify-between py-2.5 text-foreground/75"><span>{n}</span><span className="tabular-nums">{v}</span></li>
                ))}
                <li className="flex justify-between py-2.5 text-foreground/75"><span>GST (18%)</span><span className="tabular-nums">₹450.00</span></li>
                <li className="flex justify-between py-3 text-base font-extrabold text-foreground"><span>Total</span><span className="tabular-nums">₹2,950.00</span></li>
              </ul>

              <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-5 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4">
                <Donut
                  size={96}
                  thickness={13}
                  slices={[
                    { value: 82, className: 'text-emerald-500', label: 'Collected' },
                    { value: 18, className: 'text-amber-400', label: 'Pending' },
                  ]}
                  center={<span className="text-sm font-extrabold text-foreground"><CountUp to={82} suffix="%" /></span>}
                />
                <div>
                  <p className="text-xs font-semibold text-foreground/65">Collected this month (sample)</p>
                  <BarChart data={[48, 62, 55, 71, 66, 82]} labels={['M1', 'M2', 'M3', 'M4', 'M5', 'M6']} className="text-emerald-500" height={86} highlight={5} />
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BILLING_FEATURES.map((b, i) => (
            <Reveal as="li" key={b.title} delay={(i % 3) * 0.07} y={20} className="group h-full rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40 hover:bg-foreground/[0.06] hover:shadow-lg">
              <span className="grid size-10 place-items-center rounded-xl bg-cyan-500/15 text-cyan-700 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 dark:text-cyan-300">
                <b.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-3 font-bold text-foreground">{b.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-foreground/60">{b.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
