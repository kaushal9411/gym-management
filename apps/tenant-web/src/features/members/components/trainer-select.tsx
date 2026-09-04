'use client';

import { useEffect } from 'react';
import { Lock } from 'lucide-react';

import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { useStaffList } from '@/features/staff/hooks/use-staff';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-10 w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50',
);

interface TrainerSelectProps {
  id?: string;
  value: string;
  onChange: (trainerId: string) => void;
  disabled?: boolean;
}

/**
 * Reuses the Staff Management module's list, filtered to active Trainers.
 *
 * A Trainer creating/editing a plan or class is always the trainer on it —
 * there's nothing to pick. When the signed-in user is themselves a Trainer
 * and no *other* trainer is already assigned, this renders as a locked
 * "Assigned to you" row and pins `value` to their own id, mirroring
 * mobile's `TrainerPickerField`. A plan/class already assigned to a
 * different trainer (e.g. reassigned coverage) still shows the normal
 * editable picker.
 */
export function TrainerSelect({ id, value, onChange, disabled }: TrainerSelectProps) {
  const trainers = useStaffList({ role: 'TRAINER', status: 'ACTIVE', limit: 100 });
  const currentUser = useCurrentUser();
  const isSelfTrainer = !!currentUser?.roles.includes('TRAINER') && (value === '' || value === currentUser.id);

  useEffect(() => {
    if (isSelfTrainer && currentUser && value !== currentUser.id) {
      onChange(currentUser.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelfTrainer, currentUser?.id]);

  if (isSelfTrainer && currentUser) {
    return (
      <div id={id} className={cn(selectClassName, 'flex items-center justify-between text-foreground')}>
        <span>Assigned to you</span>
        <Lock className="size-3.5 text-muted-foreground" aria-hidden />
      </div>
    );
  }

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
