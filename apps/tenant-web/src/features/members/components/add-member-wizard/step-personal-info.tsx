'use client';

import { Gift, MapPin, Target, User } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { BranchSelect } from '../branch-select';
import { PanelCard } from '../detail/detail-ui';
import { BODY_TYPE_LABELS, FOOD_PREFERENCE_LABELS, GOAL_LABELS, MARITAL_STATUS_LABELS, type MemberExtendedInfoFormState } from '../member-extended-info-fields';
import { MemberProgramFields, type MemberProgramFormState } from '../member-program-fields';
import { TrainerSelect } from '../trainer-select';
import { computeAge, type WizardCorePersonalState } from './types';
import { ChipSelect, FieldGroup } from './wizard-ui';
import type { BodyType, FitnessGoal, FoodPreference, Gender, MaritalStatus } from '../../types';

const GENDERS = [
  ['MALE', 'Male'],
  ['FEMALE', 'Female'],
  ['OTHER', 'Other'],
  ['PREFER_NOT_TO_SAY', 'Prefer not to say'],
] as const satisfies ReadonlyArray<readonly [Gender, string]>;

const entries = <T extends string>(map: Record<T, string>) => (Object.keys(map) as T[]).map((k) => [k, map[k]] as const);

interface StepPersonalInfoProps {
  core: WizardCorePersonalState;
  onCoreChange: (value: WizardCorePersonalState) => void;
  extended: MemberExtendedInfoFormState;
  onExtendedChange: (value: MemberExtendedInfoFormState) => void;
  program: MemberProgramFormState;
  onProgramChange: (value: MemberProgramFormState) => void;
  /** Turns on the red highlight for required fields after a failed Next. */
  showErrors?: boolean;
  disabled?: boolean;
}

export function StepPersonalInfo({ core, onCoreChange, extended, onExtendedChange, program, onProgramChange, showErrors, disabled }: StepPersonalInfoProps) {
  const set = <K extends keyof WizardCorePersonalState>(key: K, next: WizardCorePersonalState[K]) => onCoreChange({ ...core, [key]: next });
  const setExt = <K extends keyof MemberExtendedInfoFormState>(key: K, next: MemberExtendedInfoFormState[K]) => onExtendedChange({ ...extended, [key]: next });
  const age = computeAge(core);
  const nameMissing = showErrors && (!core.firstName.trim() || !core.lastName.trim());
  const contactMissing = showErrors && !core.phone.trim() && !core.email.trim();

  return (
    <div className="space-y-5">
      <PanelCard icon={User} accent="primary" title="Basic details" delay={0}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName" required>Full name</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input id="firstName" placeholder="First name" value={core.firstName} disabled={disabled} aria-invalid={nameMissing || undefined} onChange={(e) => set('firstName', e.target.value)} />
              <Input aria-label="Last name" placeholder="Last name" value={core.lastName} disabled={disabled} aria-invalid={nameMissing || undefined} onChange={(e) => set('lastName', e.target.value)} />
            </div>
            {nameMissing ? <p role="alert" className="text-xs text-destructive">Enter the member&apos;s full name.</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="memberId">Member ID</Label>
            <Input id="memberId" placeholder="Auto-generated if left blank" value={core.memberId} disabled={disabled} onChange={(e) => set('memberId', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" required>Phone</Label>
            <Input id="phone" type="tel" value={core.phone} disabled={disabled} aria-invalid={contactMissing || undefined} onChange={(e) => set('phone', e.target.value)} />
            {contactMissing ? <p role="alert" className="text-xs text-destructive">Enter a phone number or an email address.</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={core.email} disabled={disabled} aria-invalid={contactMissing || undefined} onChange={(e) => set('email', e.target.value)} />
          </div>
        </div>

        <FieldGroup label="Gender">
          <ChipSelect label="Gender" value={core.gender} options={GENDERS} onChange={(v) => set('gender', v)} accent="primary" disabled={disabled} />
        </FieldGroup>

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
            <Input id="age" value={age ?? ''} placeholder="auto" disabled readOnly className={cn('font-bold', age !== null && 'bg-primary/10 text-primary')} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="joiningDate" required>Date of joining</Label>
            <Input id="joiningDate" type="date" value={core.joiningDate} disabled={disabled} aria-invalid={(showErrors && !core.joiningDate) || undefined} onChange={(e) => set('joiningDate', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="occupation">Occupation</Label>
            <Input id="occupation" value={core.occupation} disabled={disabled} onChange={(e) => set('occupation', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="branchId" required>Branch</Label>
            <BranchSelect id="branchId" value={core.branchId} onChange={(v) => set('branchId', v)} disabled={disabled} />
            {showErrors && !core.branchId ? <p role="alert" className="text-xs text-destructive">Select a branch.</p> : null}
          </div>
        </div>

        <div className="max-w-sm space-y-2">
          <Label htmlFor="trainerId">Trainer (optional)</Label>
          <TrainerSelect id="trainerId" value={core.trainerId} onChange={(v) => set('trainerId', v)} disabled={disabled} />
        </div>
      </PanelCard>

      <PanelCard icon={MapPin} accent="aqua" title="Address" delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
      </PanelCard>

      <PanelCard icon={Target} accent="success" title="Body and goals" delay={0.1}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="height">Height (cm)</Label>
            <Input id="height" type="number" min={0} step="0.1" value={core.height} disabled={disabled} onChange={(e) => set('height', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input id="weight" type="number" min={0} step="0.1" value={core.weight} disabled={disabled} onChange={(e) => set('weight', e.target.value)} />
          </div>
        </div>
        <FieldGroup label="Goal">
          <ChipSelect<FitnessGoal> label="Goal" value={extended.goal} options={entries(GOAL_LABELS)} onChange={(v) => setExt('goal', v)} accent="success" disabled={disabled} />
        </FieldGroup>
        <FieldGroup label="Body type">
          <ChipSelect<BodyType> label="Body type" value={extended.bodyType} options={entries(BODY_TYPE_LABELS)} onChange={(v) => setExt('bodyType', v)} accent="success" disabled={disabled} />
        </FieldGroup>
        <FieldGroup label="Food">
          <ChipSelect<FoodPreference> label="Food preference" value={extended.foodPreference} options={entries(FOOD_PREFERENCE_LABELS)} onChange={(v) => setExt('foodPreference', v)} accent="success" disabled={disabled} />
        </FieldGroup>
      </PanelCard>

      <PanelCard icon={Gift} accent="violet" title="More details" delay={0.15}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fatherNameOrAadhaar">Father&apos;s name / Aadhaar no.</Label>
            <Input id="fatherNameOrAadhaar" value={extended.fatherNameOrAadhaar} disabled={disabled} onChange={(e) => setExt('fatherNameOrAadhaar', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="anniversary">Anniversary</Label>
            <Input id="anniversary" type="date" value={extended.anniversary} disabled={disabled} onChange={(e) => setExt('anniversary', e.target.value)} />
          </div>
        </div>
        <FieldGroup label="Marital status">
          <ChipSelect<MaritalStatus> label="Marital status" value={extended.maritalStatus} options={entries(MARITAL_STATUS_LABELS)} onChange={(v) => setExt('maritalStatus', v)} accent="violet" disabled={disabled} />
        </FieldGroup>
        <div className="max-w-xs space-y-2">
          <Label htmlFor="registrationFee">Registration fee</Label>
          <Input id="registrationFee" type="number" min={0} step="0.01" value={extended.registrationFee} disabled={disabled} onChange={(e) => setExt('registrationFee', e.target.value)} />
          <p className="text-[11.5px] text-muted-foreground">One-time gym fee, separate from the plan&apos;s own registration fee.</p>
        </div>
      </PanelCard>

      <PanelCard icon={Gift} accent="warning" title="Program" delay={0.2}>
        <MemberProgramFields value={program} onChange={onProgramChange} disabled={disabled} optional />
      </PanelCard>
    </div>
  );
}
