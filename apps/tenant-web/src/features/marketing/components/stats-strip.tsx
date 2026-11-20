'use client';

import { BarChart3, BellRing, Smartphone, Send } from 'lucide-react';

import { CountUp, Reveal } from './motion';

/** Counts that are true of the product today (message channels, automatic reminders, report types, role apps). */
const STATS = [
  { icon: Send, to: 5, label: 'message channels', hint: 'Push, in-app, email, SMS, WhatsApp' },
  { icon: BellRing, to: 9, label: 'automatic reminders', hint: 'Expiry, overdue, classes and more' },
  { icon: BarChart3, to: 18, label: 'report types', hint: 'Export as PDF, Excel or CSV' },
  { icon: Smartphone, to: 5, label: 'role-based apps', hint: 'Owner, manager, reception, trainer, member' },
];

const MARQUEE = ['Members', 'Attendance', 'QR check-in', 'Workout plans', 'Diet plans', 'Class booking', 'Invoices', 'GST', 'Razorpay payments', 'Renewals', 'Bulk messages', 'Reports', 'Multi-branch', 'Staff roles', 'AI assistant'];

export function StatsStrip() {
  return (
    <section aria-label="The product in numbers" className="border-y border-foreground/10 bg-foreground/[0.03]">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08} y={18}>
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-500/20 to-cyan-400/20 text-orange-600 dark:text-orange-300">
                <s.icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                  <CountUp to={s.to} />
                </p>
                <p className="text-sm font-semibold text-foreground/80">{s.label}</p>
                <p className="mt-0.5 hidden text-xs text-foreground/50 sm:block">{s.hint}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="home-marquee relative overflow-hidden border-t border-foreground/10 py-3.5" aria-hidden>
        <div className="home-marquee-track flex w-max gap-3">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} className="whitespace-nowrap rounded-full border border-foreground/12 bg-card px-4 py-1.5 text-sm font-medium text-foreground/70">
              {m}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
