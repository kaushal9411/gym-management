'use client';

import { MemberHealthScreeningFields, type MemberHealthFormState } from '../member-health-screening-fields';

interface StepHealthScreeningProps {
  value: MemberHealthFormState;
  onChange: (value: MemberHealthFormState) => void;
  disabled?: boolean;
}

export function StepHealthScreening({ value, onChange, disabled }: StepHealthScreeningProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Health Background Screening</h3>
      <MemberHealthScreeningFields value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}
