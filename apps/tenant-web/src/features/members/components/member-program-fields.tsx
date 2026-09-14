'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrencySymbol } from '@/lib/currency';
import { useAssignablePlans } from '../hooks/use-members';
import { MembershipPlanSelect } from './membership-plan-select';

export interface MemberProgramFormState {
  planId: string;
  startDate: string;
  targetWeight: string;
}

export const DEFAULT_MEMBER_PROGRAM_FORM_STATE: MemberProgramFormState = {
  planId: '',
  startDate: '',
  targetWeight: '',
};

interface MemberProgramFieldsProps {
  value: MemberProgramFormState;
  onChange: (value: MemberProgramFormState) => void;
  disabled?: boolean;
  /** Program selection isn't hard-required — a walk-in member can be created with no plan yet, assigned later from their detail page. */
  optional?: boolean;
}

/** Program (= this app's Membership Plan) selection for the Add Member wizard's step 1 — the reference screenshots' "Program" field. */
export function MemberProgramFields({ value, onChange, disabled, optional }: MemberProgramFieldsProps) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const plans = useAssignablePlans();
  const currencySymbol = useCurrencySymbol();
  const set = <K extends keyof MemberProgramFormState>(key: K, next: MemberProgramFormState[K]) => onChange({ ...value, [key]: next });
  const selectedPlan = plans.data?.find((p) => p.id === value.planId) ?? null;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="programPlanId" required={!optional}>
          Program{optional ? ' (optional — assign one later if not ready)' : ''}
        </Label>
        <div className="flex gap-2">
          <div className="flex-1">
            <MembershipPlanSelect id="programPlanId" value={value.planId} onChange={(planId) => set('planId', planId)} disabled={disabled} />
          </div>
          <Button type="button" variant="secondary" disabled={!value.planId} onClick={() => setDetailsOpen(true)}>
            Details
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="programStartDate">Start date</Label>
        <Input id="programStartDate" type="date" value={value.startDate} disabled={disabled || !value.planId} onChange={(e) => set('startDate', e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="programTargetWeight">Target weight (kg)</Label>
        <Input
          id="programTargetWeight"
          type="number"
          min={0}
          step="0.1"
          value={value.targetWeight}
          disabled={disabled || !value.planId}
          onChange={(e) => set('targetWeight', e.target.value)}
        />
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPlan?.name ?? 'Plan details'}</DialogTitle>
          </DialogHeader>
          {selectedPlan ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Duration</dt>
              <dd>{selectedPlan.durationValue} {selectedPlan.durationType.toLowerCase()}</dd>
              <dt className="text-muted-foreground">Price</dt>
              <dd>{currencySymbol}{selectedPlan.price}</dd>
              <dt className="text-muted-foreground">Joining fee</dt>
              <dd>{currencySymbol}{selectedPlan.joiningFee}</dd>
              <dt className="text-muted-foreground">PT sessions included</dt>
              <dd>{selectedPlan.ptSessionsIncluded}</dd>
              <dt className="text-muted-foreground">Group classes included</dt>
              <dd>{selectedPlan.groupClassesIncluded}</dd>
              <dt className="text-muted-foreground">Guest passes</dt>
              <dd>{selectedPlan.guestPasses}</dd>
              <dt className="text-muted-foreground">Diet consultation</dt>
              <dd>{selectedPlan.dietConsultationIncluded ? 'Included' : 'Not included'}</dd>
              <dt className="text-muted-foreground">Locker access</dt>
              <dd>{selectedPlan.lockerAccess ? 'Included' : 'Not included'}</dd>
              <dt className="text-muted-foreground">Freeze allowed</dt>
              <dd>{selectedPlan.freezeAllowed ? (selectedPlan.freezeDaysLimit ? `Up to ${selectedPlan.freezeDaysLimit} day(s)` : 'Yes, uncapped') : 'No'}</dd>
              <dt className="text-muted-foreground">Gym access</dt>
              <dd>{selectedPlan.gymAccessAllBranches ? 'All branches' : 'Selected branches only'}</dd>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
