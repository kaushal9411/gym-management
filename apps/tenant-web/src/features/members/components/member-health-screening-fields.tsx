'use client';

import { X } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { MemberCheckinSearch } from '@/features/attendance/components/member-checkin-search';
import type { AwarenessSource, BloodGroup } from '../types';

const selectClassName = cn(
  'h-10 w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50',
);

const textareaClassName = cn(
  'flex min-h-20 w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40',
);

export interface MemberHealthFormState {
  healthHeartCondition: boolean;
  healthPainDuringActivity: boolean;
  healthDizzinessOrBalance: boolean;
  healthDiabetesOrBp: boolean;
  healthAsthma: boolean;
  healthBoneOrJointProblem: boolean;
  healthOtherCondition: boolean;
  awarenessSource: AwarenessSource | '';
  referredByMemberId: string;
  referredByMemberLabel: string;
  bloodGroup: BloodGroup | '';
  healthScreeningOtherDetails: string;
}

export const DEFAULT_MEMBER_HEALTH_FORM_STATE: MemberHealthFormState = {
  healthHeartCondition: false,
  healthPainDuringActivity: false,
  healthDizzinessOrBalance: false,
  healthDiabetesOrBp: false,
  healthAsthma: false,
  healthBoneOrJointProblem: false,
  healthOtherCondition: false,
  awarenessSource: '',
  referredByMemberId: '',
  referredByMemberLabel: '',
  bloodGroup: '',
  healthScreeningOtherDetails: '',
};

const AWARENESS_SOURCE_LABELS: Record<AwarenessSource, string> = {
  SOCIAL_MEDIA: 'Social media',
  FRIEND_REFERRAL: 'Friend referral',
  WALK_IN: 'Walk-in',
  ADVERTISEMENT: 'Advertisement',
  ONLINE_SEARCH: 'Online search',
  OTHER: 'Other',
};

const BLOOD_GROUP_LABELS: Record<BloodGroup, string> = {
  A_POSITIVE: 'A+',
  A_NEGATIVE: 'A-',
  B_POSITIVE: 'B+',
  B_NEGATIVE: 'B-',
  AB_POSITIVE: 'AB+',
  AB_NEGATIVE: 'AB-',
  O_POSITIVE: 'O+',
  O_NEGATIVE: 'O-',
  UNKNOWN: 'Unknown',
};

const QUESTIONS: Array<{ key: keyof MemberHealthFormState & string; label: string }> = [
  { key: 'healthHeartCondition', label: 'Do you suffer from a heart condition or have ever had any form of heart disease, previously suffered a heart attack, or have a family history of heart disease?' },
  { key: 'healthPainDuringActivity', label: 'Do you experience any pain while undertaking physical activity or exercising?' },
  { key: 'healthDizzinessOrBalance', label: 'Have you ever experienced faintness, dizziness, shortness of breath, or experienced a loss of balance while undertaking physical activity or exercise?' },
  { key: 'healthDiabetesOrBp', label: 'Do you have diabetes or suffer from high blood pressure?' },
  { key: 'healthAsthma', label: 'Do you suffer from asthma?' },
  { key: 'healthBoneOrJointProblem', label: 'Do you have a bone or joint problem that could be aggravated by a change in your level of physical activity?' },
  { key: 'healthOtherCondition', label: 'Do you have any other medical condition or injury, currently taking medication, or know of any other reason that would prevent you from exercising?' },
];

interface MemberHealthScreeningFieldsProps {
  value: MemberHealthFormState;
  onChange: (value: MemberHealthFormState) => void;
  disabled?: boolean;
  /** The edit page already has its own Blood Group field in its "Basic information" card — suppress the duplicate here rather than showing the same field twice on one page. */
  hideBloodGroup?: boolean;
}

/** Health Background Screening questionnaire (Add Member wizard, Prompt 82) — shared by the create wizard's step 2 and the edit page's "Health Screening" card. */
export function MemberHealthScreeningFields({ value, onChange, disabled, hideBloodGroup }: MemberHealthScreeningFieldsProps) {
  const set = <K extends keyof MemberHealthFormState>(key: K, next: MemberHealthFormState[K]) => onChange({ ...value, [key]: next });

  return (
    <div className="space-y-6">
      <div className="divide-y rounded-lg border">
        {QUESTIONS.map((q) => (
          <div key={q.key} className="flex items-center justify-between gap-4 p-3">
            <p className="text-sm">{q.label}</p>
            <select
              aria-label={q.label}
              className={cn(selectClassName, 'w-28 shrink-0')}
              value={value[q.key] ? 'yes' : 'no'}
              disabled={disabled}
              onChange={(e) => set(q.key, e.target.value === 'yes')}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="awarenessSource">How did you get to know about the gym?</Label>
          <select
            id="awarenessSource"
            className={selectClassName}
            value={value.awarenessSource}
            disabled={disabled}
            onChange={(e) => set('awarenessSource', e.target.value as AwarenessSource | '')}
          >
            <option value="">Select source</option>
            {(Object.keys(AWARENESS_SOURCE_LABELS) as AwarenessSource[]).map((k) => (
              <option key={k} value={k}>
                {AWARENESS_SOURCE_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        {!hideBloodGroup ? (
          <div className="space-y-2">
            <Label htmlFor="bloodGroup">Blood group</Label>
            <select
              id="bloodGroup"
              className={selectClassName}
              value={value.bloodGroup}
              disabled={disabled}
              onChange={(e) => set('bloodGroup', e.target.value as BloodGroup | '')}
            >
              <option value="">Select blood group</option>
              {(Object.keys(BLOOD_GROUP_LABELS) as BloodGroup[]).map((k) => (
                <option key={k} value={k}>
                  {BLOOD_GROUP_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="space-y-2 sm:col-span-2">
          <Label>Reference (referred by an existing member)</Label>
          {value.referredByMemberId ? (
            <div className="flex h-10 items-center justify-between rounded-lg border border-input bg-muted/40 px-3.5 text-sm">
              <span>{value.referredByMemberLabel}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...value, referredByMemberId: '', referredByMemberLabel: '' })}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Remove referral"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <MemberCheckinSearch
              placeholder="Search a member who referred this person…"
              onSelect={(member) => onChange({ ...value, referredByMemberId: member.id, referredByMemberLabel: `${member.name} (${member.memberId})` })}
            />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="healthScreeningOtherDetails">Other details</Label>
        <textarea
          id="healthScreeningOtherDetails"
          className={textareaClassName}
          value={value.healthScreeningOtherDetails}
          disabled={disabled}
          onChange={(e) => set('healthScreeningOtherDetails', e.target.value)}
        />
      </div>
    </div>
  );
}
