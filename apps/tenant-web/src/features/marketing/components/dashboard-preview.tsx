'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BellRing, CheckCircle2, IndianRupee, UserPlus } from 'lucide-react';

import { AreaChart, BarChart, Donut, Sparkline } from './charts';
import { CountUp } from './motion';

const REVENUE = [38, 44, 41, 52, 49, 61, 58, 70, 66, 78, 74, 91];
const WEEK = [62, 71, 68, 80, 74, 96, 58];

/** Rolling "what just happened" cards, the way the real app shows live activity. All names and amounts are made up. */
const EVENTS = [
  { icon: IndianRupee, tone: 'text-emerald-600 dark:text-emerald-300', title: 'Payment received', body: '₹2,499 · Aarav K. · Monthly plan' },
  { icon: UserPlus, tone: 'text-orange-600 dark:text-orange-300', title: 'New member joined', body: 'Diya S. · Quarterly plan' },
  { icon: BellRing, tone: 'text-cyan-700 dark:text-cyan-300', title: 'Renewal reminder sent', body: '38 members · push and email' },
  { icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-300', title: 'Invoice marked paid', body: 'INV-1042 · Kabir M.' },
];

function Kpi({ label, to, prefix, series, tone }: { label: string; to: number; prefix?: string; series: number[]; tone: string }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-3">
      <p className="text-[11px] font-medium text-foreground/55">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <CountUp to={to} prefix={prefix} className="text-xl font-extrabold tabular-nums tracking-tight text-foreground sm:text-2xl" />
        <Sparkline data={series} className={tone} />
      </div>
    </div>
  );
}

function LiveToasts() {
  const reduce = useReducedMotion();
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % EVENTS.length), 3200);
    return () => window.clearInterval(id);
  }, [reduce]);
  const e = EVENTS[i]!;
  return (
    <div className="h-[58px]" aria-live="off">
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={reduce ? false : { opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, y: -14, scale: 0.96 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-card px-3.5 py-2.5 shadow-lg"
        >
          <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-foreground/[0.06] ${e.tone}`}>
            <e.icon className="size-[18px]" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-foreground">{e.title}</span>
            <span className="block truncate text-xs text-foreground/55">{e.body}</span>
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** The big animated dashboard in the hero. Everything in it is sample data and says so. */
export function DashboardPreview() {
  const reduce = useReducedMotion();
  const float = (d: number) => (reduce ? undefined : { y: [0, -8, 0], transition: { duration: d, repeat: Infinity, ease: 'easeInOut' as const } });
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div aria-hidden className="absolute -inset-8 rounded-[2.5rem] bg-gradient-to-br from-orange-500/25 via-transparent to-cyan-400/25 blur-3xl" />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 30, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        className="relative rounded-3xl border border-foreground/15 bg-card/90 p-4 shadow-2xl backdrop-blur sm:p-5"
      >
        <div className="mb-3 flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-orange-400/80" />
          <span className="size-2.5 rounded-full bg-foreground/25" />
          <span className="size-2.5 rounded-full bg-cyan-400/80" />
          <span className="ml-3 text-[11px] font-semibold tracking-wide text-foreground/45">Owner dashboard · Sample data</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <Kpi label="Active members" to={482} series={[20, 24, 23, 30, 34, 38]} tone="text-orange-500" />
          <Kpi label="Check-ins today" to={96} series={[12, 30, 22, 40, 36, 44]} tone="text-cyan-500" />
          <Kpi label="Collected" to={482300} prefix="₹" series={[10, 14, 13, 20, 19, 26]} tone="text-emerald-500" />
        </div>

        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-3">
            <div className="mb-1 flex items-baseline justify-between">
              <p className="text-xs font-semibold text-foreground/70">Revenue, last 12 months</p>
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">▲ trending up</p>
            </div>
            <AreaChart data={REVENUE} labels={['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov']} height={130} />
          </div>
          <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-3">
            <p className="mb-2 text-xs font-semibold text-foreground/70">Members by status</p>
            <div className="flex items-center gap-3">
              <Donut
                size={92}
                thickness={12}
                slices={[
                  { value: 74, className: 'text-orange-500', label: 'Active' },
                  { value: 14, className: 'text-amber-400', label: 'Expiring' },
                  { value: 12, className: 'text-cyan-500', label: 'Other' },
                ]}
                center={<span className="text-[11px] font-bold leading-tight text-foreground">74%<br />active</span>}
              />
              <ul className="space-y-1 text-[11px] text-foreground/60">
                <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-orange-500" />Active</li>
                <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" />Expiring</li>
                <li className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-cyan-500" />Other</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-2.5 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-3">
          <p className="mb-1 text-xs font-semibold text-foreground/70">Check-ins by weekday</p>
          <BarChart data={WEEK} labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']} highlight={5} height={96} />
        </div>
      </motion.div>

      <motion.div animate={float(6)} className="absolute -bottom-12 -left-3 z-10 w-[17rem] max-w-[80%] sm:-left-8">
        <LiveToasts />
      </motion.div>
      <motion.div
        animate={float(7.5)}
        className="absolute -right-2 -top-5 z-10 hidden rounded-2xl border border-foreground/10 bg-card px-3.5 py-2.5 shadow-lg sm:block"
      >
        <p className="text-[11px] font-medium text-foreground/55">Overdue this week</p>
        <p className="text-lg font-extrabold tabular-nums text-foreground">
          <CountUp to={7} /> <span className="text-xs font-semibold text-orange-600 dark:text-orange-300">reminders sent</span>
        </p>
      </motion.div>
    </div>
  );
}
