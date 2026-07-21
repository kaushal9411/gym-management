'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { DurationType } from '../types';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

export interface PlanFormState {
  name: string;
  planCode: string;
  description: string;
  category: string;
  durationValue: string;
  durationType: DurationType;
  price: string;
  joiningFee: string;
  taxPercentage: string;
  discountPercentage: string;
  displayOrder: string;
  notes: string;
  gymAccessAllBranches: boolean;
  ptSessionsIncluded: string;
  groupClassesIncluded: string;
  dietConsultationIncluded: boolean;
  lockerAccess: boolean;
  guestPasses: string;
  freezeAllowed: boolean;
  freezeDaysLimit: string;
  validityStart: string;
  validityEnd: string;
  gracePeriodDays: string;
  renewalWindowDays: string;
  autoRenewalAllowed: boolean;
  minAge: string;
  maxAge: string;
}

export const DEFAULT_PLAN_FORM_STATE: PlanFormState = {
  name: '',
  planCode: '',
  description: '',
  category: '',
  durationValue: '1',
  durationType: 'MONTHS',
  price: '',
  joiningFee: '',
  taxPercentage: '',
  discountPercentage: '',
  displayOrder: '0',
  notes: '',
  gymAccessAllBranches: true,
  ptSessionsIncluded: '0',
  groupClassesIncluded: '0',
  dietConsultationIncluded: false,
  lockerAccess: false,
  guestPasses: '0',
  freezeAllowed: true,
  freezeDaysLimit: '',
  validityStart: '',
  validityEnd: '',
  gracePeriodDays: '0',
  renewalWindowDays: '0',
  autoRenewalAllowed: true,
  minAge: '',
  maxAge: '',
};

interface PlanFormFieldsProps {
  value: PlanFormState;
  onChange: (value: PlanFormState) => void;
  disabled?: boolean;
  /** Hide the Plan Code field entirely (auto-generated) rather than just disabling it. */
  hidePlanCode?: boolean;
}

export function PlanFormFields({ value, onChange, disabled, hidePlanCode }: PlanFormFieldsProps) {
  const set = <K extends keyof PlanFormState>(key: K, next: PlanFormState[K]) => onChange({ ...value, [key]: next });

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h3 className="text-sm font-medium">Plan information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="planName">Plan name</Label>
            <Input id="planName" value={value.name} disabled={disabled} onChange={(e) => set('name', e.target.value)} />
          </div>
          {!hidePlanCode ? (
            <div className="space-y-2">
              <Label htmlFor="planCode">Plan code (optional — auto-generated if left blank)</Label>
              <Input id="planCode" value={value.planCode} disabled={disabled} onChange={(e) => set('planCode', e.target.value)} />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="planCategory">Category</Label>
            <Input id="planCategory" value={value.category} disabled={disabled} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Premium" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planDisplayOrder">Display order</Label>
            <Input id="planDisplayOrder" type="number" min={0} value={value.displayOrder} disabled={disabled} onChange={(e) => set('displayOrder', e.target.value)} />
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

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="planDurationValue">Duration</Label>
            <Input id="planDurationValue" type="number" min={1} value={value.durationValue} disabled={disabled} onChange={(e) => set('durationValue', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planDurationType">Duration type</Label>
            <select
              id="planDurationType"
              className={selectClassName}
              value={value.durationType}
              disabled={disabled}
              onChange={(e) => set('durationType', e.target.value as DurationType)}
            >
              <option value="DAYS">Days</option>
              <option value="WEEKS">Weeks</option>
              <option value="MONTHS">Months</option>
              <option value="YEARS">Years</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="planPrice">Price</Label>
            <Input id="planPrice" type="number" min={0} step="0.01" value={value.price} disabled={disabled} onChange={(e) => set('price', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planJoiningFee">Joining fee</Label>
            <Input id="planJoiningFee" type="number" min={0} step="0.01" value={value.joiningFee} disabled={disabled} onChange={(e) => set('joiningFee', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planTax">Tax %</Label>
            <Input id="planTax" type="number" min={0} max={100} step="0.01" value={value.taxPercentage} disabled={disabled} onChange={(e) => set('taxPercentage', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planDiscount">Discount %</Label>
            <Input id="planDiscount" type="number" min={0} max={100} step="0.01" value={value.discountPercentage} disabled={disabled} onChange={(e) => set('discountPercentage', e.target.value)} />
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
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium">Plan features</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="planPtSessions">PT sessions included</Label>
            <Input id="planPtSessions" type="number" min={0} value={value.ptSessionsIncluded} disabled={disabled} onChange={(e) => set('ptSessionsIncluded', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planGroupClasses">Group classes included</Label>
            <Input id="planGroupClasses" type="number" min={0} value={value.groupClassesIncluded} disabled={disabled} onChange={(e) => set('groupClassesIncluded', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planGuestPasses">Guest passes</Label>
            <Input id="planGuestPasses" type="number" min={0} value={value.guestPasses} disabled={disabled} onChange={(e) => set('guestPasses', e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-1.5 text-sm">
            <Checkbox id="planGymAccessAllBranches" checked={value.gymAccessAllBranches} disabled={disabled} onCheckedChange={(c) => set('gymAccessAllBranches', c === true)} />
            Gym access at all branches
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <Checkbox id="planDietConsultationIncluded" checked={value.dietConsultationIncluded} disabled={disabled} onCheckedChange={(c) => set('dietConsultationIncluded', c === true)} />
            Diet consultation included
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <Checkbox id="planLockerAccess" checked={value.lockerAccess} disabled={disabled} onCheckedChange={(c) => set('lockerAccess', c === true)} />
            Locker access
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <Checkbox id="planFreezeAllowed" checked={value.freezeAllowed} disabled={disabled} onCheckedChange={(c) => set('freezeAllowed', c === true)} />
            Freeze allowed
          </label>
        </div>
        {value.freezeAllowed ? (
          <div className="max-w-xs space-y-2">
            <Label htmlFor="planFreezeDaysLimit">Freeze days limit (blank = no cap)</Label>
            <Input
              id="planFreezeDaysLimit"
              type="number"
              min={0}
              value={value.freezeDaysLimit}
              disabled={disabled}
              onChange={(e) => set('freezeDaysLimit', e.target.value)}
            />
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium">Membership rules</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="planValidityStart">Validity start (plan purchasable from)</Label>
            <Input id="planValidityStart" type="date" value={value.validityStart} disabled={disabled} onChange={(e) => set('validityStart', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planValidityEnd">Validity end (plan purchasable until)</Label>
            <Input id="planValidityEnd" type="date" value={value.validityEnd} disabled={disabled} onChange={(e) => set('validityEnd', e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="planGracePeriod">Grace period (days)</Label>
            <Input id="planGracePeriod" type="number" min={0} value={value.gracePeriodDays} disabled={disabled} onChange={(e) => set('gracePeriodDays', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planRenewalWindow">Renewal window (days, 0 = anytime)</Label>
            <Input id="planRenewalWindow" type="number" min={0} value={value.renewalWindowDays} disabled={disabled} onChange={(e) => set('renewalWindowDays', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planMinAge">Minimum age</Label>
            <Input id="planMinAge" type="number" min={0} value={value.minAge} disabled={disabled} onChange={(e) => set('minAge', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planMaxAge">Maximum age</Label>
            <Input id="planMaxAge" type="number" min={0} value={value.maxAge} disabled={disabled} onChange={(e) => set('maxAge', e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-sm">
          <Checkbox id="planAutoRenewalAllowed" checked={value.autoRenewalAllowed} disabled={disabled} onCheckedChange={(c) => set('autoRenewalAllowed', c === true)} />
          Auto-renewal allowed
        </label>
      </section>
    </div>
  );
}
