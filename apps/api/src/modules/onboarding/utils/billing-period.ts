import type { BillingCycleValue } from '../types/onboarding.types';

/** Adds one billing period to `from` — used to compute a paid subscription's current_period_end. */
export function addBillingPeriod(from: Date, cycle: BillingCycleValue): Date {
  const next = new Date(from);
  if (cycle === 'YEARLY') {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}
