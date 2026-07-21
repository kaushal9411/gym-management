'use client';

import { useAssignablePlans } from '../hooks/use-members';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

interface MembershipPlanSelectProps {
  id?: string;
  value: string;
  onChange: (planId: string) => void;
  disabled?: boolean;
}

export function MembershipPlanSelect({ id, value, onChange, disabled }: MembershipPlanSelectProps) {
  const plans = useAssignablePlans();
  return (
    <select id={id} className={selectClassName} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select a plan…</option>
      {(plans.data ?? []).map((plan) => (
        <option key={plan.id} value={plan.id}>
          {plan.name} ({plan.durationDays}d · ${plan.price})
        </option>
      ))}
    </select>
  );
}
