'use client';

import { Check, X } from 'lucide-react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import {
  getPasswordStrength,
  PASSWORD_CHECK_LABELS,
  type PasswordChecks,
} from '../utils/password-strength';

const BAR_COLORS = ['bg-muted', 'bg-destructive', 'bg-destructive', 'bg-warning', 'bg-success/80', 'bg-success'];

/** Live strength meter + policy checklist, announced politely to AT. */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password);

  return (
    <div aria-live="polite" className="space-y-2">
      <div className="flex items-center gap-2">
        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={5}
          aria-valuenow={strength.score}
          aria-label="Password strength"
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <motion.div
            className={cn('h-full rounded-full', BAR_COLORS[strength.score])}
            initial={false}
            animate={{ width: `${strength.percent}%` }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          />
        </div>
        <span className="w-16 text-right text-xs text-muted-foreground">
          {password ? strength.label : ''}
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {(Object.keys(strength.checks) as Array<keyof PasswordChecks>).map((key) => {
          const passed = strength.checks[key];
          return (
            <li
              key={key}
              className={cn(
                'flex items-center gap-1.5 text-xs transition-colors',
                passed ? 'text-success' : 'text-muted-foreground',
              )}
            >
              {passed ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}
              {PASSWORD_CHECK_LABELS[key]}
              <span className="sr-only">{passed ? '— satisfied' : '— not satisfied'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
