'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Percent, TrendingUp, UserPlus, Users } from 'lucide-react';

import { AreaChart, BarChart, Donut } from './charts';
import { FunnelChart, GroupedBars, HBars, MultiLine } from './charts-extra';
import { SectionHead } from './content-sections';
import { CountUp, Reveal } from './motion';

type Period = '30d' | '90d' | '12m';
const PERIODS: Array<{ id: Period; label: string }> = [
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: '12m', label: 'Last 12 months' },
];

/** Illustrative numbers per period. The stages and sources are the real ones a gym uses in its Leads screen. */
const DATA: Record<
  Period,
  {
    funnel: number[];
    sources: number[];
    leads: number[];
    converted: number[];
    leadLabels: string[];
    revenue: number[];
    expenses: number[];
    money: string[];
    growth: number[];
    hours: number[];
    kpi: { leads: number; conv: number; members: number; revenue: number };
  }
> = {
  '30d': {
    funnel: [120, 92, 61, 44, 31, 24],
    sources: [34, 28, 22, 18, 10, 8],
    leads: [18, 24, 21, 29, 28],
    converted: [3, 5, 4, 6, 6],
    leadLabels: ['W1', 'W2', 'W3', 'W4', 'W5'],
    revenue: [52, 61, 58, 70, 66, 78],
    expenses: [31, 33, 35, 34, 38, 36],
    money: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'],
    growth: [410, 418, 425, 433, 446, 461, 482],
    hours: [4, 9, 12, 8, 6, 5, 7, 11, 16, 20, 14, 6],
    kpi: { leads: 120, conv: 20, members: 482, revenue: 482300 },
  },
  '90d': {
    funnel: [356, 270, 182, 131, 94, 71],
    sources: [96, 84, 67, 52, 30, 27],
    leads: [96, 112, 118, 130, 126, 136],
    converted: [15, 19, 21, 24, 26, 28],
    leadLabels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
    revenue: [140, 152, 148, 166, 171, 190],
    expenses: [88, 91, 95, 93, 99, 102],
    money: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
    growth: [380, 396, 410, 428, 447, 466, 482],
    hours: [10, 24, 33, 22, 17, 14, 20, 31, 45, 58, 39, 17],
    kpi: { leads: 356, conv: 20, members: 482, revenue: 1388200 },
  },
  '12m': {
    funnel: [1380, 1040, 702, 498, 366, 281],
    sources: [372, 330, 261, 207, 118, 92],
    leads: [74, 88, 96, 90, 112, 118, 126, 121, 134, 129, 141, 150],
    converted: [11, 14, 16, 15, 20, 22, 24, 23, 27, 26, 29, 31],
    leadLabels: ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
    revenue: [48, 55, 60, 58, 66, 71, 69, 77, 82, 88, 93, 101],
    expenses: [33, 35, 37, 36, 40, 41, 40, 44, 46, 47, 49, 52],
    money: ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
    growth: [210, 248, 290, 318, 350, 381, 402, 421, 440, 455, 470, 482],
    hours: [40, 96, 128, 88, 66, 58, 79, 121, 176, 224, 152, 64],
    kpi: { leads: 1380, conv: 20, members: 482, revenue: 5498300 },
  },
};

const STAGES = ['New', 'Contacted', 'Visit scheduled', 'Trial done', 'Negotiation', 'Converted'];
const STAGE_CLASS = ['bg-cyan-400', 'bg-cyan-500', 'bg-sky-500', 'bg-orange-300', 'bg-orange-400', 'bg-emerald-500'];
const SOURCES = ['Walk-in', 'Website', 'Referral', 'Social media', 'Phone call', 'Advertisement'];
const SOURCE_CLASS = ['bg-orange-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-400', 'bg-pink-500'];
const SOURCE_TEXT = ['text-orange-500', 'text-cyan-500', 'text-emerald-500', 'text-violet-500', 'text-amber-400', 'text-pink-500'];

function Card({ title, hint, children, className = '' }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <Reveal className={className}>
      <div className="h-full rounded-3xl border border-foreground/10 bg-card p-5 shadow-sm transition-shadow duration-300 hover:shadow-lg">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {hint ? <span className="text-[11px] text-foreground/45">{hint}</span> : null}
        </div>
        {children}
      </div>
    </Reveal>
  );
}

function Kpi({ icon: Icon, label, value, prefix, suffix, tone }: { icon: typeof Users; label: string; value: number; prefix?: string; suffix?: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-card p-4">
      <span className={`grid size-9 place-items-center rounded-xl bg-foreground/[0.06] ${tone}`}><Icon className="size-[18px]" aria-hidden /></span>
      <p className="mt-3 text-2xl font-black tracking-tight tabular-nums text-foreground sm:text-3xl">
        <CountUp to={value} prefix={prefix} suffix={suffix} duration={1.1} />
      </p>
      <p className="text-xs font-medium text-foreground/55">{label}</p>
    </div>
  );
}

export function AnalyticsSection() {
  const reduce = useReducedMotion();
  const [period, setPeriod] = React.useState<Period>('30d');
  const d = DATA[period];
  const sourceTotal = d.sources.reduce((a, b) => a + b, 0);

  return (
    <section id="analytics" className="relative scroll-mt-20 border-t border-foreground/10 py-20 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute -left-40 top-24 size-[28rem] rounded-full bg-orange-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead eyebrow="Analytics" title="See where members and money come from" body="Leads, revenue, attendance and growth on one dashboard. Switch the period and every chart redraws." />

        <Reveal className="mt-8 flex justify-center">
          <div role="group" aria-label="Period" className="inline-flex flex-wrap justify-center gap-1 rounded-full border border-foreground/12 bg-foreground/[0.04] p-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={period === p.id}
                onClick={() => setPeriod(p.id)}
                className={`relative rounded-full px-4 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${period === p.id ? 'text-background' : 'text-foreground/65 hover:text-foreground'}`}
              >
                {period === p.id ? <motion.span layoutId="analytics-period" className="absolute inset-0 rounded-full bg-foreground" transition={{ type: 'spring', stiffness: 400, damping: 34 }} /> : null}
                <span className="relative">{p.label}</span>
              </button>
            ))}
          </div>
        </Reveal>
        <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-wider text-foreground/40">Sample data for illustration</p>

        {/* Re-keying on the period makes every chart below draw again. */}
        <AnimatePresence mode="wait">
          <motion.div
            key={period}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-8"
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi icon={UserPlus} label="New leads" value={d.kpi.leads} tone="text-cyan-600 dark:text-cyan-300" />
              <Kpi icon={Percent} label="Lead to member rate" value={d.kpi.conv} suffix="%" tone="text-emerald-600 dark:text-emerald-300" />
              <Kpi icon={Users} label="Active members" value={d.kpi.members} tone="text-orange-600 dark:text-orange-300" />
              <Kpi icon={TrendingUp} label="Collected" value={d.kpi.revenue} prefix="₹" tone="text-violet-600 dark:text-violet-300" />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-6">
              <Card title="Lead funnel" hint="% kept from the step before" className="lg:col-span-3">
                <FunnelChart steps={STAGES.map((label, i) => ({ label, value: d.funnel[i]!, className: STAGE_CLASS[i]! }))} />
              </Card>
              <Card title="Leads by source" className="lg:col-span-3">
                <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr]">
                  <Donut
                    size={132}
                    thickness={16}
                    slices={SOURCES.map((label, i) => ({ label, value: d.sources[i]!, className: SOURCE_TEXT[i]! }))}
                    center={<span className="text-xs font-bold leading-tight text-foreground"><CountUp to={sourceTotal} duration={1} /><br /><span className="font-medium text-foreground/50">leads</span></span>}
                  />
                  <HBars rows={SOURCES.map((label, i) => ({ label, value: d.sources[i]!, className: SOURCE_CLASS[i]! }))} />
                </div>
              </Card>

              <Card title="New leads vs converted" hint="by period" className="lg:col-span-2">
                <MultiLine
                  labels={d.leadLabels}
                  series={[
                    { name: 'New leads', values: d.leads, className: 'text-cyan-500' },
                    { name: 'Converted', values: d.converted, className: 'text-emerald-500' },
                  ]}
                />
              </Card>
              <Card title="Revenue vs expenses" hint="₹ thousands" className="lg:col-span-2">
                <GroupedBars labels={d.money} a={{ name: 'Revenue', values: d.revenue, className: 'text-orange-500' }} b={{ name: 'Expenses', values: d.expenses, className: 'text-foreground/35' }} />
              </Card>
              <Card title="Member growth" className="lg:col-span-2">
                <AreaChart data={d.growth} className="text-emerald-500" height={140} />
                <p className="mt-1 text-xs text-foreground/50">Active members over the period.</p>
              </Card>

              <Card title="Check-ins by hour" hint="6 am to 11 pm" className="lg:col-span-3">
                <BarChart data={d.hours} labels={['6', '', '8', '', '10', '', '12', '', '4', '6', '8', '10']} className="text-cyan-500" height={120} highlight={9} />
                <p className="mt-1 text-xs text-foreground/50">Evenings are busiest, so that is when to schedule classes and staff.</p>
              </Card>
              <Card title="Class seats filled" hint="average" className="lg:col-span-3">
                <HBars
                  unit="%"
                  rows={[
                    { label: 'HIIT', value: 92, className: 'bg-orange-500' },
                    { label: 'Spin', value: 84, className: 'bg-amber-400' },
                    { label: 'Zumba', value: 71, className: 'bg-pink-500' },
                    { label: 'Yoga', value: 63, className: 'bg-cyan-500' },
                  ]}
                />
              </Card>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
