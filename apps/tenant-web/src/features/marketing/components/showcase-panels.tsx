'use client';

/** The animated mini-screens shown in the feature showcase. All data is made up and labelled as sample data. */
import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Download, Dumbbell, Flame } from 'lucide-react';

import { AreaChart, BarChart, Donut, Heatmap, Ring } from './charts';

const EASE = [0.22, 1, 0.36, 1] as const;

function useRise() {
  const reduce = useReducedMotion();
  return (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay: 0.05 + i * 0.07, ease: EASE } });
}

const Pill = ({ tone, children }: { tone: 'green' | 'amber' | 'blue' | 'red'; children: React.ReactNode }) => {
  const t = {
    green: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    blue: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
    red: 'bg-red-500/15 text-red-700 dark:text-red-300',
  }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${t}`}>{children}</span>;
};

const Card = ({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 ${className ?? ''}`}>
    {title ? <p className="mb-2 text-xs font-semibold text-foreground/65">{title}</p> : null}
    {children}
  </div>
);

export function MembersPanel() {
  const rise = useRise();
  const rows = [
    ['Aarav K.', 'MEM-0142', 'Monthly', 'Active', 'green'],
    ['Diya S.', 'MEM-0143', 'Quarterly', 'Expiring', 'amber'],
    ['Kabir M.', 'MEM-0144', 'Annual', 'Active', 'green'],
    ['Meera P.', 'MEM-0145', 'Monthly', 'Frozen', 'blue'],
  ] as const;
  return (
    <div className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
      <Card title="Members">
        <ul className="divide-y divide-foreground/10">
          {rows.map((r, i) => (
            <motion.li key={r[1]} {...rise(i)} className="flex items-center gap-3 py-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-orange-500 to-cyan-400 text-xs font-bold text-[#1a0f08]">{r[0].charAt(0)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{r[0]}</span>
                <span className="block text-xs text-foreground/50">{r[1]} · {r[2]}</span>
              </span>
              <Pill tone={r[4]}>{r[3]}</Pill>
            </motion.li>
          ))}
        </ul>
      </Card>
      <Card title="New members, last 8 weeks">
        <AreaChart data={[4, 7, 6, 10, 9, 14, 12, 17]} className="text-orange-500" height={140} />
        <p className="mt-2 text-xs text-foreground/50">Freeze, renew or upgrade a plan in one tap. Every payment and visit is on the profile.</p>
      </Card>
    </div>
  );
}

export function AttendancePanel() {
  const rows = [
    [0, 1, 2, 3, 2, 1, 0, 0, 1, 2, 3, 4],
    [0, 1, 2, 3, 3, 1, 0, 0, 1, 2, 4, 3],
    [0, 1, 1, 2, 2, 1, 0, 0, 1, 3, 4, 3],
    [0, 1, 2, 3, 2, 1, 0, 0, 1, 2, 3, 4],
    [0, 1, 2, 2, 2, 1, 0, 0, 2, 3, 4, 2],
    [1, 3, 4, 4, 3, 2, 1, 1, 1, 2, 2, 1],
    [1, 2, 3, 3, 2, 1, 0, 0, 0, 1, 1, 0],
  ];
  return (
    <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
      <Card title="Busy hours, by weekday">
        <Heatmap rows={rows} rowLabels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']} />
        <div className="mt-2 flex justify-between text-[10px] text-foreground/45"><span>6 am</span><span>12 pm</span><span>6 pm</span><span>11 pm</span></div>
      </Card>
      <Card title="Today at the desk">
        <div className="flex items-center gap-4">
          <Ring value={0.72} className="text-cyan-500" size={92}>
            <span className="text-sm font-extrabold text-foreground">72%</span>
          </Ring>
          <p className="text-xs leading-relaxed text-foreground/60">Check members in by QR code, from an attendance device or at the desk.</p>
        </div>
      </Card>
    </div>
  );
}

export function TrainingPanel() {
  const rise = useRise();
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card title="Workout this week">
        <div className="flex items-center gap-3">
          <Ring value={0.75} size={84} className="text-orange-500">
            <Dumbbell className="size-5 text-orange-500" aria-hidden />
          </Ring>
          <div>
            <p className="text-2xl font-extrabold text-foreground">3 of 4</p>
            <p className="text-xs text-foreground/55">sessions done</p>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5" aria-label="Streak">
          {[1, 1, 1, 0, 1, 1, 0].map((d, i) => (
            <motion.span key={i} {...rise(i)} className={`grid size-6 place-items-center rounded-md text-[10px] ${d ? 'bg-orange-500 text-[#1a0f08]' : 'bg-foreground/10 text-foreground/40'}`}>
              {d ? <Flame className="size-3" aria-hidden /> : ''}
            </motion.span>
          ))}
        </div>
      </Card>
      <Card title="Diet today" className="md:col-span-2">
        <div className="grid grid-cols-[auto_1fr] items-center gap-4">
          <Donut
            size={96}
            thickness={13}
            slices={[
              { value: 34, className: 'text-orange-500', label: 'Protein' },
              { value: 46, className: 'text-cyan-500', label: 'Carbs' },
              { value: 20, className: 'text-amber-400', label: 'Fat' },
            ]}
            center={<span className="text-[11px] font-bold leading-tight text-foreground">1,640<br />kcal</span>}
          />
          <div className="space-y-2">
            {[['Protein', 78, 'bg-orange-500'], ['Carbs', 64, 'bg-cyan-500'], ['Fat', 52, 'bg-amber-400']].map(([l, v, c], i) => (
              <div key={String(l)}>
                <div className="mb-0.5 flex justify-between text-[11px] text-foreground/60"><span>{l}</span><span>{v}% of plan</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
                  <motion.div className={`h-full rounded-full ${c}`} initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.9, delay: 0.2 + i * 0.12, ease: EASE }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

export function ClassesPanel() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const blocks: Array<{ d: number; row: number; t: string; seats: string; tone: string }> = [
    { d: 0, row: 0, t: 'HIIT', seats: '14/20', tone: 'bg-orange-500/20 text-orange-700 dark:text-orange-200 border-orange-500/40' },
    { d: 1, row: 1, t: 'Yoga', seats: '9/15', tone: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-200 border-cyan-500/40' },
    { d: 2, row: 0, t: 'Spin', seats: '18/20', tone: 'bg-amber-500/20 text-amber-700 dark:text-amber-200 border-amber-500/40' },
    { d: 3, row: 1, t: 'Zumba', seats: '12/25', tone: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border-emerald-500/40' },
    { d: 4, row: 0, t: 'HIIT', seats: '20/20', tone: 'bg-orange-500/20 text-orange-700 dark:text-orange-200 border-orange-500/40' },
  ];
  const reduce = useReducedMotion();
  return (
    <Card title="Weekly timetable">
      <div className="grid grid-cols-5 gap-2">
        {days.map((d) => (
          <p key={d} className="text-center text-[11px] font-semibold text-foreground/50">{d}</p>
        ))}
        {[0, 1].flatMap((row) =>
          days.map((_, d) => {
            const b = blocks.find((x) => x.d === d && x.row === row);
            return b ? (
              <motion.div
                key={`${row}-${d}`}
                initial={reduce ? false : { opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.08 * (d + row * 5) * 0.6, type: 'spring', stiffness: 220, damping: 18 }}
                className={`rounded-xl border p-2 ${b.tone}`}
              >
                <p className="text-xs font-bold">{b.t}</p>
                <p className="text-[10px] opacity-80">{b.seats} seats</p>
              </motion.div>
            ) : (
              <div key={`${row}-${d}`} className="rounded-xl border border-dashed border-foreground/10" />
            );
          }),
        )}
      </div>
      <p className="mt-3 text-xs text-foreground/50">Members book a seat in the app. When a class changes, the booked members are told.</p>
    </Card>
  );
}

export function MessagesPanel() {
  const [on, setOn] = React.useState<Record<string, boolean>>({ Push: true, Email: true, SMS: false, WhatsApp: false });
  const chan: Array<[string, string]> = [['Push', 'bg-violet-500'], ['Email', 'bg-blue-500'], ['SMS', 'bg-amber-500'], ['WhatsApp', 'bg-emerald-500']];
  return (
    <div className="grid gap-3 md:grid-cols-[1.1fr_1fr]">
      <Card title="New message">
        <p className="rounded-xl border border-foreground/10 bg-card px-3 py-2 text-sm font-semibold text-foreground">Winter offer at your gym</p>
        <p className="mt-2 rounded-xl border border-foreground/10 bg-card px-3 py-2 text-xs text-foreground/60">Hi {'{{firstName}}'}, beat the cold with our winter offer. Ask at the front desk for the details.</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Channels">
          {chan.map(([n, c]) => (
            <button
              key={n}
              type="button"
              aria-pressed={on[n]}
              onClick={() => setOn((p) => ({ ...p, [n]: !p[n] }))}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${on[n] ? 'border-foreground/40 bg-foreground/10 text-foreground' : 'border-foreground/15 text-foreground/55 hover:bg-foreground/5'}`}
            >
              <span className={`size-2 rounded-full ${c}`} />
              {n}
            </button>
          ))}
        </div>
      </Card>
      <Card title="Result of a send (sample)">
        <div className="flex h-3 overflow-hidden rounded-full bg-foreground/10">
          <motion.div className="bg-emerald-500" initial={{ width: 0 }} animate={{ width: '86%' }} transition={{ duration: 1, ease: EASE }} />
          <motion.div className="bg-red-500" initial={{ width: 0 }} animate={{ width: '4%' }} transition={{ duration: 1, delay: 0.2, ease: EASE }} />
          <motion.div className="bg-amber-400" initial={{ width: 0 }} animate={{ width: '10%' }} transition={{ duration: 1, delay: 0.3, ease: EASE }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/60"><span>● 344 sent</span><span>● 16 failed</span><span>● 40 opted out</span></div>
        <p className="mt-3 text-xs text-foreground/50">Pick members by filter or by hand. Reminders for expiring plans, overdue payments and classes can run on their own.</p>
      </Card>
    </div>
  );
}

export function ReportsPanel() {
  return (
    <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
      <Card title="Revenue by month">
        <BarChart data={[42, 55, 49, 63, 58, 74]} labels={['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']} className="text-orange-500" height={130} highlight={5} />
      </Card>
      <Card title="Export">
        <div className="space-y-2">
          {['PDF', 'Excel', 'CSV'].map((f, i) => (
            <motion.div
              key={f}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.1, duration: 0.4, ease: EASE }}
              className="flex items-center justify-between rounded-xl border border-foreground/10 bg-card px-3 py-2.5 text-sm font-semibold text-foreground"
            >
              {f}
              <Download className="size-4 text-foreground/50" aria-hidden />
            </motion.div>
          ))}
        </div>
        <p className="mt-3 text-xs text-foreground/50">Revenue, attendance, members and expenses, by branch and date.</p>
      </Card>
    </div>
  );
}
