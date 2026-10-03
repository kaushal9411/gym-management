'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Check, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrencySymbol } from '@/lib/currency';
import { useAssignablePlans } from '../hooks/use-members';
import type { MembershipPlan } from '../types';
import { computePlanPrice } from '../utils/plan-pricing';
import { type Accent, accentVar, formatMoney, tint } from './detail/detail-ui';

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

const PLAN_TONES: Accent[] = ['primary', 'violet', 'success', 'aqua', 'warning'];

interface MemberProgramFieldsProps {
  value: MemberProgramFormState;
  onChange: (value: MemberProgramFormState) => void;
  disabled?: boolean;
  /** Program selection isn't hard-required — a walk-in member can be created with no plan yet, assigned later from their detail page. */
  optional?: boolean;
}

function planTags(plan: MembershipPlan): string[] {
  const tags: string[] = [];
  if (plan.ptSessionsIncluded > 0) tags.push(`${plan.ptSessionsIncluded} PT sessions`);
  if (plan.groupClassesIncluded > 0) tags.push(`${plan.groupClassesIncluded} classes`);
  if (plan.guestPasses > 0) tags.push(`${plan.guestPasses} guest passes`);
  if (plan.dietConsultationIncluded) tags.push('Diet consult');
  if (plan.lockerAccess) tags.push('Locker');
  if (plan.freezeAllowed) tags.push('Freeze');
  return tags.slice(0, 4);
}

/** Program (= this app's Membership Plan) selection for the Add Member wizard — selectable plan cards with the real discount/tax-adjusted price, plus start date and target weight. */
export function MemberProgramFields({ value, onChange, disabled, optional }: MemberProgramFieldsProps) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const plans = useAssignablePlans();
  const currencySymbol = useCurrencySymbol();
  const set = <K extends keyof MemberProgramFormState>(key: K, next: MemberProgramFormState[K]) => onChange({ ...value, [key]: next });
  const selectedPlan = plans.data?.find((p) => p.id === value.planId) ?? null;

  return (
    <div className="space-y-4">
      <p className="text-[13px] font-semibold">
        Program{optional ? <span className="ml-1.5 font-normal text-muted-foreground">(optional, assign one later if not ready)</span> : null}
      </p>

      {plans.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      ) : (plans.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No active plans yet. Create one under Memberships.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="group" aria-label="Program">
          {(plans.data ?? []).map((plan, i) => {
            const tone = PLAN_TONES[i % PLAN_TONES.length]!;
            const price = computePlanPrice(plan);
            const on = plan.id === value.planId;
            return (
              <motion.button
                key={plan.id}
                type="button"
                disabled={disabled}
                aria-pressed={on}
                onClick={() => set('planId', on ? '' : plan.id)}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                className="relative flex flex-col gap-2 rounded-2xl border-2 p-4 text-left transition-shadow disabled:opacity-50"
                style={{
                  borderColor: on ? accentVar(tone) : 'var(--border)',
                  backgroundImage: on ? `linear-gradient(160deg, ${tint(tone, 12)}, transparent)` : undefined,
                  boxShadow: on ? `0 18px 32px -18px ${accentVar(tone)}` : undefined,
                }}
              >
                <motion.span
                  initial={false}
                  animate={{ scale: on ? 1 : 0 }}
                  className="absolute right-3 top-3 grid size-6 place-items-center rounded-full text-white"
                  style={{ backgroundColor: accentVar(tone) }}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </motion.span>
                <h3 className="pr-8 text-base font-extrabold">{plan.name}</h3>
                <div className="text-2xl font-extrabold leading-tight tabular-nums" style={{ color: accentVar(tone) }}>
                  {formatMoney(currencySymbol, price.finalPrice)}
                  {price.finalPrice !== price.basePrice ? <s className="ml-1.5 text-[13px] font-semibold text-muted-foreground">{formatMoney(currencySymbol, price.basePrice)}</s> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {plan.durationValue} {plan.durationValue === 1 ? plan.durationType.toLowerCase().replace(/s$/, '') : plan.durationType.toLowerCase()}
                  {Number(plan.discountPercentage) > 0 ? ` · ${plan.discountPercentage}% off` : ''}
                  {Number(plan.taxPercentage) > 0 ? ` · ${plan.taxPercentage}% tax` : ''}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {planTags(plan).map((t) => (
                    <span key={t} className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: tint(tone, 13), color: accentVar(tone) }}>
                      {t}
                    </span>
                  ))}
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="programStartDate">Start date</Label>
          <Input id="programStartDate" type="date" value={value.startDate} disabled={disabled || !value.planId} onChange={(e) => set('startDate', e.target.value)} />
          <p className="text-[11.5px] text-muted-foreground">A future date starts the membership later.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="programTargetWeight">Target weight (kg)</Label>
          <Input id="programTargetWeight" type="number" min={0} step="0.1" value={value.targetWeight} disabled={disabled || !value.planId} onChange={(e) => set('targetWeight', e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <Button type="button" variant="outline" className="h-10" disabled={!value.planId} onClick={() => setDetailsOpen(true)}>
            <Info className="size-4" /> Plan details
          </Button>
        </div>
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
              <dd>{currencySymbol}{Number(selectedPlan.price).toFixed(2)}</dd>
              {Number(selectedPlan.discountPercentage) > 0 ? (
                <>
                  <dt className="text-muted-foreground">Discount ({selectedPlan.discountPercentage}%)</dt>
                  <dd>-{currencySymbol}{computePlanPrice(selectedPlan).discountAmount.toFixed(2)}</dd>
                </>
              ) : null}
              {Number(selectedPlan.taxPercentage) > 0 ? (
                <>
                  <dt className="text-muted-foreground">Tax ({selectedPlan.taxPercentage}%)</dt>
                  <dd>{currencySymbol}{computePlanPrice(selectedPlan).taxAmount.toFixed(2)}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Registration fee</dt>
              <dd>{currencySymbol}{Number(selectedPlan.joiningFee).toFixed(2)}</dd>
              <dt className="font-medium text-foreground">Total</dt>
              <dd className="font-medium">{currencySymbol}{computePlanPrice(selectedPlan).totalWithJoiningFee.toFixed(2)}</dd>
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
