'use client';

import { cn } from '@/lib/utils';
import type { StaffRole } from '../types';

const ROLE_OPTIONS: Array<{ value: StaffRole; label: string; description: string }> = [
  { value: 'MANAGER', label: 'Manager', description: 'Runs day-to-day operations for a branch' },
  { value: 'TRAINER', label: 'Trainer', description: 'Leads workouts, classes, and member coaching' },
  { value: 'RECEPTIONIST', label: 'Receptionist', description: 'Front-desk check-in, payments, and enquiries' },
];

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

interface StaffRoleSelectProps {
  id?: string;
  value: StaffRole;
  onChange: (role: StaffRole) => void;
  disabled?: boolean;
}

/** Staff has exactly one of the three staff roles — the Owner already exists and isn't managed here. */
export function StaffRoleSelect({ id, value, onChange, disabled }: StaffRoleSelectProps) {
  return (
    <select
      id={id}
      className={selectClassName}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as StaffRole)}
    >
      {ROLE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export { ROLE_OPTIONS as STAFF_ROLE_OPTIONS };
