'use client';

import { Check } from 'lucide-react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { WIZARD_STEPS } from '../types';
import type { WizardStep } from '../types';

const STEP_LABELS: Record<WizardStep, string> = {
  account: 'Account',
  otp: 'Verify email',
  plan: 'Plan',
  subdomain: 'Portal address',
  payment: 'Payment',
  success: 'Done',
};

/** Horizontal stepper — current step highlighted, prior steps marked complete. */
export function ProgressIndicator({ current }: { current: WizardStep }) {
  const currentIndex = WIZARD_STEPS.indexOf(current);

  return (
    <ol className="flex w-full items-center" aria-label="Registration progress">
      {WIZARD_STEPS.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === WIZARD_STEPS.length - 1;

        return (
          <li key={step} className={cn('flex items-center', !isLast && 'flex-1')}>
            <div className="flex flex-col items-center gap-1">
              <motion.div
                initial={false}
                animate={{ scale: isCurrent ? 1.1 : 1 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-300',
                  isComplete || isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isComplete ? <Check className="size-3.5" aria-hidden /> : index + 1}
              </motion.div>
              <span
                className={cn(
                  'hidden text-[11px] font-medium sm:block',
                  isCurrent ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
            {!isLast ? (
              <div className="mx-1.5 h-0.5 flex-1 rounded-full bg-muted sm:mb-4">
                <motion.div
                  initial={false}
                  animate={{ width: isComplete ? '100%' : '0%' }}
                  transition={{ duration: 0.3 }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
