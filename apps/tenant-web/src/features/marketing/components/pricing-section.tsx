'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';

import { AUTH_ROUTES } from '@/features/auth/constants';
import type { SubscriptionPlan } from '@/features/onboarding/types';
import { SectionHead, Tick } from './content-sections';
import { Reveal } from './motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function fetchPlans(): Promise<SubscriptionPlan[]> {
  const res = await fetch(`${API_URL}/onboarding/plans`);
  if (!res.ok) throw new Error('plans');
  const body = (await res.json()) as { data: SubscriptionPlan[] };
  return body.data;
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/** The plan catalogue stores "no practical limit" as 9999. */
const limit = (n: number, label: string): string => (n < 0 || n >= 9999 ? `Unlimited ${label}` : `Up to ${n.toLocaleString('en-IN')} ${label}`);

/** The middle plan is highlighted, which is how the three seeded plans read (Starter, Professional, Enterprise). */
const featuredIndex = (plans: SubscriptionPlan[]): number => (plans.length === 3 ? 1 : -1);

export function PricingSection() {
  const [yearly, setYearly] = React.useState(false);
  const plans = useQuery({ queryKey: ['public', 'plans'], queryFn: fetchPlans, staleTime: 5 * 60_000, retry: 1 });
  const items = (plans.data ?? []).slice().sort((a, b) => a.priceMonthly - b.priceMonthly);
  const hasYearly = items.some((p) => p.priceYearly > 0);
  const fi = featuredIndex(items);

  return (
    <section id="pricing" className="scroll-mt-20 border-t border-foreground/10 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead eyebrow="Pricing" title="Simple plans that grow with your gym" body="Prices are per gym. Pick a plan when you register; you can change it later." />

        {hasYearly ? (
          <div className="mt-8 flex justify-center">
            <div role="group" aria-label="Billing period" className="inline-flex rounded-full border border-foreground/15 bg-foreground/5 p-1">
              {[
                { v: false, label: 'Monthly' },
                { v: true, label: 'Yearly' },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={yearly === o.v}
                  onClick={() => setYearly(o.v)}
                  className={`rounded-full px-5 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${yearly === o.v ? 'bg-foreground text-background' : 'text-foreground/70 hover:text-foreground'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {plans.isPending ? (
          <div className="mt-10 grid gap-4 lg:grid-cols-3" aria-busy="true" aria-label="Loading plans">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-96 animate-pulse rounded-3xl border border-foreground/10 bg-foreground/[0.04]" />
            ))}
          </div>
        ) : plans.isError || items.length === 0 ? (
          <div role="alert" className="mx-auto mt-10 max-w-lg rounded-2xl border border-foreground/15 bg-foreground/5 p-6 text-center">
            <p className="font-semibold text-foreground">We could not load the plans right now.</p>
            <p className="mt-1 text-sm text-foreground/65">You can still register to see them, or ask us for a quote.</p>
            <div className="mt-4 flex justify-center gap-3">
              <button type="button" onClick={() => void plans.refetch()} className="rounded-lg border border-foreground/25 px-4 py-2 text-sm font-semibold text-foreground hover:bg-foreground/10">
                Try again
              </button>
              <a href="#contact" className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background">Ask for a quote</a>
            </div>
          </div>
        ) : (
          <ul className="mt-10 grid gap-5 lg:grid-cols-3">
            {items.map((p, i) => {
              const featured = i === fi;
              const price = yearly && p.priceYearly > 0 ? p.priceYearly : p.priceMonthly;
              const included = p.features.filter((f) => f.included);
              return (
                <Reveal
                  as="li"
                  key={p.slug}
                  delay={i * 0.1}
                  className={`group relative flex flex-col rounded-3xl border p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${featured ? 'border-orange-400/60 bg-gradient-to-b from-orange-500/15 to-foreground/[0.03] shadow-[0_20px_60px_-24px_rgba(255,106,53,0.6)]' : 'border-foreground/10 bg-foreground/[0.03]'}`}
                >
                  {featured ? <span className="absolute -top-3 left-7 rounded-full bg-orange-400 px-3 py-1 text-xs font-bold text-[#1a0f08]">Most popular</span> : null}
                  <h3 className="text-xl font-bold text-foreground">{p.name}</h3>
                  {p.description ? <p className="mt-1 text-sm text-foreground/60">{p.description}</p> : null}
                  <p className="mt-5 flex items-baseline gap-1.5">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={price}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="text-4xl font-black tracking-tight text-foreground tabular-nums"
                      >
                        {money(price, p.currency)}
                      </motion.span>
                    </AnimatePresence>
                    <span className="text-sm text-foreground/55">/ {yearly && p.priceYearly > 0 ? 'year' : 'month'}</span>
                  </p>
                  {p.trialDays > 0 ? <p className="mt-1 text-sm font-medium text-cyan-700 dark:text-cyan-300">{p.trialDays}-day free trial</p> : <p className="mt-1 text-sm text-foreground/40">&nbsp;</p>}
                  <ul className="mt-5 space-y-2.5 border-t border-foreground/10 pt-5">
                    <Tick>{limit(p.limits.maxMembers, 'members')}</Tick>
                    <Tick>{limit(p.limits.maxBranches, p.limits.maxBranches === 1 ? 'branch' : 'branches')}</Tick>
                    {included.slice(0, 6).map((f) => (
                      <Tick key={f.key}>{f.label}</Tick>
                    ))}
                  </ul>
                  {included.length > 6 ? <p className="mt-3 text-xs text-foreground/50">and {included.length - 6} more features</p> : null}
                  <div className="mt-auto pt-7">
                    <Link
                      href={AUTH_ROUTES.register}
                      className={`inline-flex h-12 w-full items-center justify-center rounded-xl text-base font-bold outline-none transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] ${featured ? 'bg-gradient-to-r from-orange-500 to-orange-400 text-[#1a0f08]' : 'border border-foreground/25 text-foreground hover:bg-foreground/10'}`}
                    >
                      Register your gym
                    </Link>
                  </div>
                </Reveal>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
