'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrainerSelect } from '@/features/members/components/trainer-select';
import { cn } from '@/lib/utils';
import type { WorkoutLevel } from '../types';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

export interface WorkoutPlanFormState {
  name: string;
  description: string;
  goal: string;
  level: WorkoutLevel;
  durationWeeks: string;
  trainerId: string;
  isActive: boolean;
  notes: string;
}

export const DEFAULT_WORKOUT_PLAN_FORM_STATE: WorkoutPlanFormState = {
  name: '',
  description: '',
  goal: '',
  level: 'BEGINNER',
  durationWeeks: '4',
  trainerId: '',
  isActive: true,
  notes: '',
};

interface WorkoutPlanFormFieldsProps {
  value: WorkoutPlanFormState;
  onChange: (value: WorkoutPlanFormState) => void;
  disabled?: boolean;
}

export function WorkoutPlanFormFields({ value, onChange, disabled }: WorkoutPlanFormFieldsProps) {
  const set = <K extends keyof WorkoutPlanFormState>(key: K, next: WorkoutPlanFormState[K]) => onChange({ ...value, [key]: next });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="planName">Plan name</Label>
          <Input id="planName" value={value.name} disabled={disabled} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="planGoal">Goal</Label>
          <Input id="planGoal" value={value.goal} disabled={disabled} onChange={(e) => set('goal', e.target.value)} placeholder="e.g. Fat loss" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="planDescription">Description</Label>
        <textarea
          id="planDescription"
          className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          value={value.description}
          disabled={disabled}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="planLevel">Level</Label>
          <select id="planLevel" className={selectClassName} value={value.level} disabled={disabled} onChange={(e) => set('level', e.target.value as WorkoutLevel)}>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="planDurationWeeks">Duration (weeks)</Label>
          <Input
            id="planDurationWeeks"
            type="number"
            min={1}
            value={value.durationWeeks}
            disabled={disabled}
            onChange={(e) => set('durationWeeks', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="planTrainer">Trainer</Label>
          <TrainerSelect id="planTrainer" value={value.trainerId} onChange={(v) => set('trainerId', v)} disabled={disabled} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="planNotes">Notes</Label>
        <textarea
          id="planNotes"
          className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          value={value.notes}
          disabled={disabled}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>

      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox id="planIsActive" checked={value.isActive} disabled={disabled} onCheckedChange={(c) => set('isActive', c === true)} />
        Active (visible for assignment)
      </label>
    </div>
  );
}
