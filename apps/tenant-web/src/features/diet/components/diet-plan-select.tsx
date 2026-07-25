'use client';

import { cn } from '@/lib/utils';
import { useAssignableDietPlans } from '../hooks/use-diet';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

interface DietPlanSelectProps {
  id?: string;
  value: string;
  onChange: (planId: string) => void;
  disabled?: boolean;
}

export function DietPlanSelect({ id, value, onChange, disabled }: DietPlanSelectProps) {
  const plans = useAssignableDietPlans();
  return (
    <select id={id} className={selectClassName} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select a diet plan…</option>
      {(plans.data ?? []).map((plan) => (
        <option key={plan.id} value={plan.id}>
          {plan.name} ({plan.durationDays}d{plan.dailyCalories ? ` · ${plan.dailyCalories} kcal` : ''})
        </option>
      ))}
    </select>
  );
}
