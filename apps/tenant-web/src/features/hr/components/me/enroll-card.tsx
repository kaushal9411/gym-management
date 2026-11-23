'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Plane, ReceiptIndianRupee, UserPlus, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { LoadingButton } from '@/components/ui/loading-button';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { hrKeys, useEnrollMe } from '../../hooks/use-hr';
import { runEnroll } from '../../lib/enroll';
import { HR_HERO_BG, mix } from '../../lib/hr-palette';

const PERKS = [
  { icon: CalendarCheck, label: 'Check in and out', tone: 'var(--success)' },
  { icon: Plane, label: 'Apply for leave', tone: 'var(--chart-7)' },
  { icon: ReceiptIndianRupee, label: 'Get payslips', tone: 'var(--chart-3)' },
];

/** Opt-in card for people who manage HR but are not on the employee roster (typically the owner). Enrols on click only. */
export function EnrollCard() {
  const m = useMotionSafe();
  const qc = useQueryClient();
  const enroll = useEnrollMe();
  const [error, setError] = React.useState<string | null>(null);
  const busy = enroll.isPending;

  const onClick = async () => {
    if (busy) return;
    setError(null);
    const outcome = await runEnroll({ enroll: () => enroll.mutateAsync(), refetch: () => qc.invalidateQueries({ queryKey: hrKeys.all }) });
    if (outcome.status === 'enrolled') toast.success('You are on the employee roster. Welcome to My HR!');
    else if (outcome.status === 'already') toast.info('You are already on the roster - refreshing.');
    else {
      setError(outcome.message);
      toast.error(outcome.message);
    }
  };

  return (
    <motion.section
      initial={m.reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      aria-labelledby="enroll-title"
      className="relative overflow-hidden rounded-[28px] border bg-card p-5 shadow-sm sm:p-8"
    >
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-30 blur-3xl" style={{ backgroundImage: HR_HERO_BG }} />
      <div className="relative grid items-center gap-6 md:grid-cols-[auto_1fr]">
        <motion.div
          animate={m.reduce ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="flex size-20 items-center justify-center rounded-3xl text-white shadow-lg"
          style={{ backgroundImage: HR_HERO_BG }}
        >
          <UserRound className="size-10" aria-hidden />
        </motion.div>
        <div className="min-w-0 space-y-3">
          <div>
            <h2 id="enroll-title" className="text-2xl font-extrabold">
              You are not on the employee roster
            </h2>
            <p className="mt-1 max-w-2xl text-[14.5px] text-muted-foreground">
              As the owner you can manage HR without being an employee. Add yourself to check in, apply for leave and get payslips. You will then count in HR attendance and absent numbers, and you cannot remove yourself later from here.
            </p>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="What you get">
            {PERKS.map((p) => (
              <li key={p.label} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: mix(p.tone, 14), color: p.tone }}>
                <p.icon className="size-3.5" aria-hidden /> {p.label}
              </li>
            ))}
          </ul>
          {error ? (
            <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm font-semibold text-destructive">
              {error}
            </p>
          ) : null}
          <LoadingButton type="button" size="lg" loading={busy} loadingText="Adding you..." onClick={onClick}>
            <UserPlus className="size-5" aria-hidden /> Add me as an employee
          </LoadingButton>
        </div>
      </div>
    </motion.section>
  );
}
