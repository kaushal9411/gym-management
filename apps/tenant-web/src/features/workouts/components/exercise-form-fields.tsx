'use client';

import * as React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fileToDataUrl } from '@/lib/image-to-data-url';
import { cn } from '@/lib/utils';
import type { DifficultyLevel } from '../types';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

export interface ExerciseFormState {
  name: string;
  category: string;
  muscleGroup: string;
  equipment: string;
  difficultyLevel: DifficultyLevel;
  instructions: string;
  imageUrl: string;
  videoUrl: string;
  durationSeconds: string;
  defaultSets: string;
  defaultReps: string;
  restSeconds: string;
  caloriesBurnEstimate: string;
  isActive: boolean;
}

export const DEFAULT_EXERCISE_FORM_STATE: ExerciseFormState = {
  name: '',
  category: '',
  muscleGroup: '',
  equipment: '',
  difficultyLevel: 'BEGINNER',
  instructions: '',
  imageUrl: '',
  videoUrl: '',
  durationSeconds: '',
  defaultSets: '',
  defaultReps: '',
  restSeconds: '',
  caloriesBurnEstimate: '',
  isActive: true,
};

interface ExerciseFormFieldsProps {
  value: ExerciseFormState;
  onChange: (value: ExerciseFormState) => void;
  disabled?: boolean;
}

export function ExerciseFormFields({ value, onChange, disabled }: ExerciseFormFieldsProps) {
  const set = <K extends keyof ExerciseFormState>(key: K, next: ExerciseFormState[K]) => onChange({ ...value, [key]: next });
  const [uploading, setUploading] = React.useState(false);

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      set('imageUrl', await fileToDataUrl(file, 480));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="exerciseName">Exercise name</Label>
          <Input id="exerciseName" value={value.name} disabled={disabled} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exerciseCategory">Category</Label>
          <Input id="exerciseCategory" value={value.category} disabled={disabled} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Strength" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exerciseMuscleGroup">Muscle group</Label>
          <Input id="exerciseMuscleGroup" value={value.muscleGroup} disabled={disabled} onChange={(e) => set('muscleGroup', e.target.value)} placeholder="e.g. Chest" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exerciseEquipment">Equipment</Label>
          <Input id="exerciseEquipment" value={value.equipment} disabled={disabled} onChange={(e) => set('equipment', e.target.value)} placeholder="e.g. Barbell" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exerciseDifficulty">Difficulty level</Label>
          <select
            id="exerciseDifficulty"
            className={selectClassName}
            value={value.difficultyLevel}
            disabled={disabled}
            onChange={(e) => set('difficultyLevel', e.target.value as DifficultyLevel)}
          >
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="exerciseVideoUrl">Video URL (reference only)</Label>
          <Input id="exerciseVideoUrl" value={value.videoUrl} disabled={disabled} onChange={(e) => set('videoUrl', e.target.value)} placeholder="https://…" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="exerciseInstructions">Instructions</Label>
        <textarea
          id="exerciseInstructions"
          className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          value={value.instructions}
          disabled={disabled}
          onChange={(e) => set('instructions', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="exerciseDurationSeconds">Duration (s)</Label>
          <Input id="exerciseDurationSeconds" type="number" min={0} value={value.durationSeconds} disabled={disabled} onChange={(e) => set('durationSeconds', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exerciseDefaultSets">Sets</Label>
          <Input id="exerciseDefaultSets" type="number" min={0} value={value.defaultSets} disabled={disabled} onChange={(e) => set('defaultSets', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exerciseDefaultReps">Repetitions</Label>
          <Input id="exerciseDefaultReps" type="number" min={0} value={value.defaultReps} disabled={disabled} onChange={(e) => set('defaultReps', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exerciseRestSeconds">Rest time (s)</Label>
          <Input id="exerciseRestSeconds" type="number" min={0} value={value.restSeconds} disabled={disabled} onChange={(e) => set('restSeconds', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exerciseCalories">Calories burned</Label>
          <Input id="exerciseCalories" type="number" min={0} value={value.caloriesBurnEstimate} disabled={disabled} onChange={(e) => set('caloriesBurnEstimate', e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="exerciseImage">Image</Label>
        <div className="flex items-center gap-3">
          {value.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data-URL, not an optimizable remote image
            <img src={value.imageUrl} alt="" className="size-16 rounded-md border object-cover" />
          ) : null}
          <Input
            id="exerciseImage"
            type="file"
            accept="image/*"
            disabled={disabled || uploading}
            onChange={(e) => void handleImageFile(e.target.files?.[0])}
          />
        </div>
      </div>

      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox id="exerciseIsActive" checked={value.isActive} disabled={disabled} onCheckedChange={(c) => set('isActive', c === true)} />
        Active
      </label>
    </div>
  );
}
