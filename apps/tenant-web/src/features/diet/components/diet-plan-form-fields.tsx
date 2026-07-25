'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrainerSelect } from '@/features/members/components/trainer-select';

export interface DietPlanFormState {
  name: string;
  description: string;
  goal: string;
  dailyCalories: string;
  durationDays: string;
  trainerId: string;
  isActive: boolean;
  notes: string;
}

export const DEFAULT_DIET_PLAN_FORM_STATE: DietPlanFormState = {
  name: '',
  description: '',
  goal: '',
  dailyCalories: '',
  durationDays: '30',
  trainerId: '',
  isActive: true,
  notes: '',
};

interface DietPlanFormFieldsProps {
  value: DietPlanFormState;
  onChange: (value: DietPlanFormState) => void;
  disabled?: boolean;
}

export function DietPlanFormFields({ value, onChange, disabled }: DietPlanFormFieldsProps) {
  const set = <K extends keyof DietPlanFormState>(key: K, next: DietPlanFormState[K]) => onChange({ ...value, [key]: next });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="planName">Plan name</Label>
          <Input id="planName" value={value.name} disabled={disabled} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="planGoal">Goal</Label>
          <Input id="planGoal" value={value.goal} disabled={disabled} onChange={(e) => set('goal', e.target.value)} placeholder="e.g. Weight loss" />
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
          <Label htmlFor="planDailyCalories">Daily calories</Label>
          <Input
            id="planDailyCalories"
            type="number"
            min={0}
            value={value.dailyCalories}
            disabled={disabled}
            onChange={(e) => set('dailyCalories', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="planDurationDays">Duration (days)</Label>
          <Input
            id="planDurationDays"
            type="number"
            min={1}
            value={value.durationDays}
            disabled={disabled}
            onChange={(e) => set('durationDays', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="planTrainer">Trainer / Nutritionist</Label>
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
