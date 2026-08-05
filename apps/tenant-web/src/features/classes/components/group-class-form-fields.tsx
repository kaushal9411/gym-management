'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BranchSelect } from '@/features/members/components/branch-select';
import { TrainerSelect } from '@/features/members/components/trainer-select';
import { cn } from '@/lib/utils';

const textareaClassName = cn(
  'flex min-h-16 w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-xs transition-all duration-150',
  'placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50',
);

export interface GroupClassFormState {
  name: string;
  description: string;
  trainerId: string;
  branchId: string;
  capacity: string;
  durationMinutes: string;
  isActive: boolean;
}

export const DEFAULT_GROUP_CLASS_FORM_STATE: GroupClassFormState = {
  name: '',
  description: '',
  trainerId: '',
  branchId: '',
  capacity: '15',
  durationMinutes: '60',
  isActive: true,
};

interface GroupClassFormFieldsProps {
  value: GroupClassFormState;
  onChange: (value: GroupClassFormState) => void;
  disabled?: boolean;
}

export function GroupClassFormFields({ value, onChange, disabled }: GroupClassFormFieldsProps) {
  const set = <K extends keyof GroupClassFormState>(key: K, next: GroupClassFormState[K]) => onChange({ ...value, [key]: next });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="className" required>Class name</Label>
          <Input id="className" value={value.name} disabled={disabled} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Morning Yoga" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="classBranch" required>Branch</Label>
          <BranchSelect id="classBranch" value={value.branchId} onChange={(v) => set('branchId', v)} disabled={disabled} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="classDescription">Description</Label>
        <textarea
          id="classDescription"
          className={textareaClassName}
          value={value.description}
          disabled={disabled}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="classTrainer">Trainer</Label>
          <TrainerSelect id="classTrainer" value={value.trainerId} onChange={(v) => set('trainerId', v)} disabled={disabled} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="classCapacity" required>Capacity</Label>
          <Input
            id="classCapacity"
            type="number"
            min={1}
            value={value.capacity}
            disabled={disabled}
            onChange={(e) => set('capacity', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="classDuration" required>Duration (minutes)</Label>
          <Input
            id="classDuration"
            type="number"
            min={1}
            value={value.durationMinutes}
            disabled={disabled}
            onChange={(e) => set('durationMinutes', e.target.value)}
          />
        </div>
      </div>

      <label htmlFor="classIsActive" className="flex items-center gap-2 text-sm">
        <Checkbox id="classIsActive" checked={value.isActive} disabled={disabled} onCheckedChange={(c) => set('isActive', c === true)} />
        Active (included in session generation)
      </label>
    </div>
  );
}
