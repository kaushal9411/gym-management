'use client';

import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

const STEPS = ['Personal & Program', 'Health Screening', 'Payment'] as const;

interface WizardProgressProps {
  current: 1 | 2 | 3;
}

/** A small local step indicator for the Add Member wizard — no generic Stepper primitive exists in `components/ui/` yet, so this is kept feature-local rather than promoted. */
export function WizardProgress({ current }: WizardProgressProps) {
  return (
    <ol className="flex items-center gap-2 sm:gap-4">
      {STEPS.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3">
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors',
                done ? 'border-primary bg-primary text-primary-foreground' : active ? 'border-primary text-primary' : 'border-muted-foreground/30 text-muted-foreground',
              )}
            >
              {done ? <Check className="size-3.5" /> : step}
            </span>
            <span className={cn('hidden text-sm sm:inline', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>{label}</span>
            {step < 3 ? <span className="h-px flex-1 bg-border" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
