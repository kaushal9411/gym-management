'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { BodyType, FitnessGoal, FoodPreference, MaritalStatus } from '../types';

const selectClassName = cn(
  'h-10 w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50',
);

export interface MemberExtendedInfoFormState {
  fatherNameOrAadhaar: string;
  maritalStatus: MaritalStatus | '';
  anniversary: string;
  goal: FitnessGoal | '';
  registrationFee: string;
  bodyType: BodyType | '';
  foodPreference: FoodPreference | '';
}

export const DEFAULT_MEMBER_EXTENDED_INFO_FORM_STATE: MemberExtendedInfoFormState = {
  fatherNameOrAadhaar: '',
  maritalStatus: '',
  anniversary: '',
  goal: '',
  registrationFee: '',
  bodyType: '',
  foodPreference: '',
};

const MARITAL_STATUS_LABELS: Record<MaritalStatus, string> = {
  SINGLE: 'Single',
  MARRIED: 'Married',
  DIVORCED: 'Divorced',
  WIDOWED: 'Widowed',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
};

const GOAL_LABELS: Record<FitnessGoal, string> = {
  WEIGHT_LOSS: 'Weight loss',
  WEIGHT_GAIN: 'Weight gain',
  MUSCLE_BUILDING: 'Muscle building',
  GENERAL_FITNESS: 'General fitness',
  ENDURANCE: 'Endurance',
  REHABILITATION: 'Rehabilitation',
  OTHER: 'Other',
};

const BODY_TYPE_LABELS: Record<BodyType, string> = {
  ECTOMORPH: 'Ectomorph (lean)',
  MESOMORPH: 'Mesomorph (athletic)',
  ENDOMORPH: 'Endomorph (heavier build)',
  AVERAGE: 'Average',
  UNKNOWN: 'Unknown',
};

const FOOD_PREFERENCE_LABELS: Record<FoodPreference, string> = {
  VEGETARIAN: 'Vegetarian',
  NON_VEGETARIAN: 'Non-vegetarian',
  VEGAN: 'Vegan',
  EGGETARIAN: 'Eggetarian',
  UNKNOWN: 'Unknown',
};

interface MemberExtendedInfoFieldsProps {
  value: MemberExtendedInfoFormState;
  onChange: (value: MemberExtendedInfoFormState) => void;
  disabled?: boolean;
}

/** The 7 fields added on top of `Member`'s pre-existing profile fields (Add Member wizard, Prompt 82) — shared by the create wizard's step 1 and the edit page's "Additional details" section. */
export function MemberExtendedInfoFields({ value, onChange, disabled }: MemberExtendedInfoFieldsProps) {
  const set = <K extends keyof MemberExtendedInfoFormState>(key: K, next: MemberExtendedInfoFormState[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="fatherNameOrAadhaar">Father&apos;s name / Aadhaar no.</Label>
        <Input
          id="fatherNameOrAadhaar"
          value={value.fatherNameOrAadhaar}
          disabled={disabled}
          onChange={(e) => set('fatherNameOrAadhaar', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="maritalStatus">Marital status</Label>
        <select
          id="maritalStatus"
          className={selectClassName}
          value={value.maritalStatus}
          disabled={disabled}
          onChange={(e) => set('maritalStatus', e.target.value as MaritalStatus | '')}
        >
          <option value="">Select status</option>
          {(Object.keys(MARITAL_STATUS_LABELS) as MaritalStatus[]).map((k) => (
            <option key={k} value={k}>
              {MARITAL_STATUS_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="anniversary">Anniversary</Label>
        <Input id="anniversary" type="date" value={value.anniversary} disabled={disabled} onChange={(e) => set('anniversary', e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="goal">Goal</Label>
        <select
          id="goal"
          className={selectClassName}
          value={value.goal}
          disabled={disabled}
          onChange={(e) => set('goal', e.target.value as FitnessGoal | '')}
        >
          <option value="">Select goal</option>
          {(Object.keys(GOAL_LABELS) as FitnessGoal[]).map((k) => (
            <option key={k} value={k}>
              {GOAL_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bodyType">Body type</Label>
        <select
          id="bodyType"
          className={selectClassName}
          value={value.bodyType}
          disabled={disabled}
          onChange={(e) => set('bodyType', e.target.value as BodyType | '')}
        >
          <option value="">Select body type</option>
          {(Object.keys(BODY_TYPE_LABELS) as BodyType[]).map((k) => (
            <option key={k} value={k}>
              {BODY_TYPE_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="foodPreference">Food</Label>
        <select
          id="foodPreference"
          className={selectClassName}
          value={value.foodPreference}
          disabled={disabled}
          onChange={(e) => set('foodPreference', e.target.value as FoodPreference | '')}
        >
          <option value="">Select food preference</option>
          {(Object.keys(FOOD_PREFERENCE_LABELS) as FoodPreference[]).map((k) => (
            <option key={k} value={k}>
              {FOOD_PREFERENCE_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="registrationFee">Registration fee</Label>
        <Input
          id="registrationFee"
          type="number"
          min={0}
          step="0.01"
          value={value.registrationFee}
          disabled={disabled}
          onChange={(e) => set('registrationFee', e.target.value)}
        />
      </div>
    </div>
  );
}
