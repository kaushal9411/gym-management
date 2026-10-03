'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

const STEPS = [
  { label: 'Personal & Program', hint: 'Details, goals, plan' },
  { label: 'Health Screening', hint: 'Safe-training questions' },
  { label: 'Payment', hint: 'Invoice and receipt' },
] as const;

interface WizardHeroProps {
  current: 1 | 2 | 3;
  /** Completed steps are clickable so staff can jump back; later steps stay locked until reached with Next. */
  onStepClick: (step: 1 | 2 | 3) => void;
}

/** Gradient header carrying the 3-step progress. No generic Stepper primitive exists in `components/ui/`, so it stays feature-local. */
export function WizardHero({ current, onStepClick }: WizardHeroProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative flex flex-col gap-5 overflow-hidden rounded-3xl p-6 pb-7 text-white shadow-lg sm:px-7"
      style={{ backgroundImage: 'radial-gradient(900px 320px at 90% -40%, color-mix(in oklch, #c026d3 75%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Members</p>
        <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl">Add a member</h1>
        <p className="mt-1 text-white/85">Three quick steps. Nothing is saved until the last one.</p>
      </div>

      <ol className="relative grid grid-cols-3 gap-3">
        <span aria-hidden className="absolute left-[16%] right-[16%] top-[22px] h-[3px] rounded-full bg-white/25" />
        <motion.span
          aria-hidden
          className="absolute left-[16%] top-[22px] h-[3px] rounded-full bg-white"
          initial={false}
          animate={{ width: `${((current - 1) / 2) * 68}%` }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        />
        {STEPS.map((s, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const done = n < current;
          const active = n === current;
          return (
            <li key={s.label} className="relative z-10 flex justify-center">
              <button
                type="button"
                disabled={n > current}
                onClick={() => onStepClick(n)}
                aria-current={active ? 'step' : undefined}
                className={cn('flex flex-col items-center gap-2 text-center transition-all disabled:cursor-default', active || done ? 'opacity-100' : 'opacity-75', active && '-translate-y-0.5')}
              >
                <motion.span
                  animate={{ scale: active ? 1.08 : 1 }}
                  className={cn(
                    'grid size-[46px] place-items-center rounded-full border-2 text-lg font-extrabold transition-colors',
                    done ? 'border-emerald-300 bg-emerald-300 text-emerald-950' : active ? 'border-white bg-white text-indigo-700 shadow-[0_0_0_7px_rgba(255,255,255,.22)]' : 'border-white/55 bg-white/15',
                  )}
                >
                  {done ? <Check className="size-5" strokeWidth={3} /> : n}
                </motion.span>
                <b className="text-[13px] font-bold">{s.label}</b>
                <small className="hidden text-xs font-medium text-white/85 sm:block">{s.hint}</small>
              </button>
            </li>
          );
        })}
      </ol>
    </motion.section>
  );
}
