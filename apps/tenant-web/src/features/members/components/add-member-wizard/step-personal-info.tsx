'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { BranchSelect } from '../branch-select';
import { MemberExtendedInfoFields, type MemberExtendedInfoFormState } from '../member-extended-info-fields';
import { MemberProgramFields, type MemberProgramFormState } from '../member-program-fields';
import { TrainerSelect } from '../trainer-select';
import { computeAge, type WizardCorePersonalState } from './types';
import type { Gender } from '../../types';

const selectClassName = cn(
  'h-10 w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50',
);

interface StepPersonalInfoProps {
  core: WizardCorePersonalState;
  onCoreChange: (value: WizardCorePersonalState) => void;
  extended: MemberExtendedInfoFormState;
  onExtendedChange: (value: MemberExtendedInfoFormState) => void;
  program: MemberProgramFormState;
  onProgramChange: (value: MemberProgramFormState) => void;
  disabled?: boolean;
}

export function StepPersonalInfo({ core, onCoreChange, extended, onExtendedChange, program, onProgramChange, disabled }: StepPersonalInfoProps) {
  const set = <K extends keyof WizardCorePersonalState>(key: K, next: WizardCorePersonalState[K]) => onCoreChange({ ...core, [key]: next });
  const age = computeAge(core);

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName" required>Full name</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input id="firstName" placeholder="First name" value={core.firstName} disabled={disabled} onChange={(e) => set('firstName', e.target.value)} />
              <Input aria-label="Last name" placeholder="Last name" value={core.lastName} disabled={disabled} onChange={(e) => set('lastName', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="memberId">Member ID (optional — auto-generated if left blank)</Label>
            <Input id="memberId" value={core.memberId} disabled={disabled} onChange={(e) => set('memberId', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" required>Phone</Label>
            <Input id="phone" type="tel" value={core.phone} disabled={disabled} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={core.email} disabled={disabled} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="addressLine">Address</Label>
            <Input id="addressLine" value={core.addressLine} disabled={disabled} onChange={(e) => set('addressLine', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" value={core.city} disabled={disabled} onChange={(e) => set('city', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stateField">State</Label>
            <Input id="stateField" value={core.state} disabled={disabled} onChange={(e) => set('state', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" value={core.country} disabled={disabled} onChange={(e) => set('country', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode">Postal code</Label>
            <Input id="postalCode" value={core.postalCode} disabled={disabled} onChange={(e) => set('postalCode', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <select id="gender" className={selectClassName} value={core.gender} disabled={disabled} onChange={(e) => set('gender', e.target.value as Gender | '')}>
              <option value="">Select gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
              <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="height">Height (cm)</Label>
            <Input id="height" type="number" min={0} step="0.1" value={core.height} disabled={disabled} onChange={(e) => set('height', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input id="weight" type="number" min={0} step="0.1" value={core.weight} disabled={disabled} onChange={(e) => set('weight', e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="dobDay">Day</Label>
            <Input id="dobDay" type="number" min={1} max={31} placeholder="DD" value={core.dobDay} disabled={disabled} onChange={(e) => set('dobDay', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dobMonth">Month</Label>
            <Input id="dobMonth" type="number" min={1} max={12} placeholder="MM" value={core.dobMonth} disabled={disabled} onChange={(e) => set('dobMonth', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dobYear">Year</Label>
            <Input id="dobYear" type="number" min={1900} max={2100} placeholder="YYYY" value={core.dobYear} disabled={disabled} onChange={(e) => set('dobYear', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="age">Age (years)</Label>
            <Input id="age" value={age ?? ''} disabled readOnly className="bg-muted/40" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="joiningDate" required>Date of joining</Label>
            <Input id="joiningDate" type="date" value={core.joiningDate} disabled={disabled} onChange={(e) => set('joiningDate', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="occupation">Occupation</Label>
            <Input id="occupation" value={core.occupation} disabled={disabled} onChange={(e) => set('occupation', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchId" required>Branch</Label>
            <BranchSelect id="branchId" value={core.branchId} onChange={(v) => set('branchId', v)} disabled={disabled} />
          </div>
        </div>

        <div className="max-w-sm space-y-2">
          <Label htmlFor="trainerId">Trainer (optional)</Label>
          <TrainerSelect id="trainerId" value={core.trainerId} onChange={(v) => set('trainerId', v)} disabled={disabled} />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium">Additional details</h3>
        <MemberExtendedInfoFields value={extended} onChange={onExtendedChange} disabled={disabled} />
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium">Program</h3>
        <MemberProgramFields value={program} onChange={onProgramChange} disabled={disabled} optional />
      </section>
    </div>
  );
}
