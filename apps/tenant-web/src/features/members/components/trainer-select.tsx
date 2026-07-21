'use client';

import { useStaffList } from '@/features/staff/hooks/use-staff';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

interface TrainerSelectProps {
  id?: string;
  value: string;
  onChange: (trainerId: string) => void;
  disabled?: boolean;
}

/** Reuses the Staff Management module's list, filtered to active Trainers. */
export function TrainerSelect({ id, value, onChange, disabled }: TrainerSelectProps) {
  const trainers = useStaffList({ role: 'TRAINER', status: 'ACTIVE', limit: 100 });
  return (
    <select id={id} className={selectClassName} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">No trainer assigned</option>
      {(trainers.data?.items ?? []).map((trainer) => (
        <option key={trainer.id} value={trainer.id}>
          {trainer.name}
        </option>
      ))}
    </select>
  );
}
