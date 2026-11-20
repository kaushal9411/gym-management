'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BarChart3, CalendarClock, Dumbbell, QrCode, Send, Users, type LucideIcon } from 'lucide-react';

import { SectionHead } from './content-sections';
import { Reveal } from './motion';
import { AttendancePanel, ClassesPanel, MembersPanel, MessagesPanel, ReportsPanel, TrainingPanel } from './showcase-panels';

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
  title: string;
  body: string;
  bullets: string[];
  Panel: React.ComponentType;
}

const TABS: Tab[] = [
  { id: 'members', label: 'Members', icon: Users, title: 'Every member, one profile', body: 'Add members in seconds, assign plans, and see their payments, visits and progress without opening three screens.', bullets: ['Plans, freeze, renew and upgrade', 'Import your list from a spreadsheet', 'Photo, health notes and emergency contact'], Panel: MembersPanel },
  { id: 'attendance', label: 'Attendance', icon: QrCode, title: 'Know who trained today', body: 'Check members in at the desk, by QR code or from an attendance device, and spot your busiest hours.', bullets: ['QR and device check-in', 'Busy-hours view by weekday', 'Reports by branch and date'], Panel: AttendancePanel },
  { id: 'training', label: 'Workouts and diet', icon: Dumbbell, title: 'Plans members actually follow', body: 'Assign workout and diet plans. Members tick off exercises and log meals from their phone, and see their own progress.', bullets: ['Exercise library and day-wise plans', 'Calories and protein from the foods in the plan', 'Streaks and weekly progress for members'], Panel: TrainingPanel },
  { id: 'classes', label: 'Classes', icon: CalendarClock, title: 'A timetable that fills itself', body: 'Run a weekly timetable, let members book seats in the app, and tell them when something changes.', bullets: ['Weekly schedules with seat limits', 'Booking limits that follow the plan', 'Notices when a class changes'], Panel: ClassesPanel },
  { id: 'messages', label: 'Messages', icon: Send, title: 'Say the right thing to the right members', body: 'Offers, holiday notices and renewal reminders by push, email, SMS or WhatsApp, to everyone or to members you pick.', bullets: ['Ready-made offer and reminder templates', 'Per-channel limits shown before you send', 'Members can opt out of promotions'], Panel: MessagesPanel },
  { id: 'reports', label: 'Reports', icon: BarChart3, title: 'Numbers you can act on', body: 'Revenue, attendance, members and expenses by branch and date, exported as PDF, Excel or CSV.', bullets: ['18 report types', 'Scheduled reports by email', 'Branch performance side by side'], Panel: ReportsPanel },
];

export function FeatureShowcase() {
  const reduce = useReducedMotion();
  const [active, setActive] = React.useState(TABS[0]!.id);
  const tab = TABS.find((t) => t.id === active) ?? TABS[0]!;

  return (
    <section id="features" className="relative scroll-mt-20 border-t border-foreground/10 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead eyebrow="Features" title="Everything the front desk, trainers and members need" body="One system for the daily work of a gym, instead of a spreadsheet, a notebook and three apps. Tap through to see it." />

        <Reveal className="mt-10">
          <div role="tablist" aria-label="Product areas" className="mx-auto flex max-w-full gap-1.5 overflow-x-auto rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-1.5 [scrollbar-width:none] sm:justify-center">
            {TABS.map((t) => {
              const on = t.id === active;
              return (
                <button
                  key={t.id}
                  id={`tab-${t.id}`}
                  role="tab"
                  type="button"
                  aria-selected={on}
                  aria-controls={`panel-${t.id}`}
                  onClick={() => setActive(t.id)}
                  className={`relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${on ? 'text-[#1a0f08]' : 'text-foreground/65 hover:text-foreground'}`}
                >
                  {on ? <motion.span layoutId="showcase-pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} className="absolute inset-0 -z-0 rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 shadow-md" /> : null}
                  <t.icon className="relative size-4" aria-hidden />
                  <span className="relative">{t.label}</span>
                </button>
              );
            })}
          </div>
        </Reveal>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[0.85fr_1.4fr]">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab.id + '-copy'}
              initial={reduce ? false : { opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: 12 }}
              transition={{ duration: 0.3 }}
              className="lg:pt-4"
            >
              <h3 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{tab.title}</h3>
              <p className="mt-3 text-base leading-relaxed text-foreground/65">{tab.body}</p>
              <ul className="mt-5 space-y-2.5">
                {tab.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-foreground/75">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gradient-to-r from-orange-500 to-cyan-400" />
                    {b}
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>

          <div className="relative rounded-3xl border border-foreground/12 bg-card p-4 shadow-xl sm:p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-foreground/40">Sample data for illustration</p>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab.id}
                id={`panel-${tab.id}`}
                role="tabpanel"
                aria-labelledby={`tab-${tab.id}`}
                initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <tab.Panel />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
