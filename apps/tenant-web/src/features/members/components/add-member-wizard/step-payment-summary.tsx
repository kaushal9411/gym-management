'use client';

import { useEffect, type ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useCurrencySymbol } from '@/lib/currency';
import type { MemberPaymentMethod } from '@/features/finance/types';
import { useAssignablePlans } from '../../hooks/use-members';
import { computePlanPrice } from '../../utils/plan-pricing';
import type { MemberExtendedInfoFormState } from '../member-extended-info-fields';
import type { MemberProgramFormState } from '../member-program-fields';
import type { WizardCorePersonalState, WizardPaymentState } from './types';

const selectClassName = cn(
  'h-10 w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50',
);

const METHOD_LABELS: Record<MemberPaymentMethod, string> = {
  CASH: 'By Cash',
  UPI: 'By UPI',
  CREDIT_CARD: 'By Credit Card',
  DEBIT_CARD: 'By Debit Card',
  BANK_TRANSFER: 'By Bank Transfer',
  CHEQUE: 'By Cheque',
  ONLINE_GATEWAY: 'By Online Gateway',
};

interface StepPaymentSummaryProps {
  core: WizardCorePersonalState;
  extended: MemberExtendedInfoFormState;
  program: MemberProgramFormState;
  payment: WizardPaymentState;
  onPaymentChange: (value: WizardPaymentState) => void;
  disabled?: boolean;
}

function row(label: string, value: ReactNode) {
  return (
    <div className="flex items-center justify-between border-b py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function StepPaymentSummary({ core, extended, program, payment, onPaymentChange, disabled }: StepPaymentSummaryProps) {
  const currencySymbol = useCurrencySymbol();
  const plans = useAssignablePlans();
  const selectedPlan = plans.data?.find((p) => p.id === program.planId) ?? null;

  const priceBreakdown = selectedPlan ? computePlanPrice(selectedPlan) : null;
  const programBasePrice = priceBreakdown?.basePrice ?? 0;
  const planDiscountAmount = priceBreakdown?.discountAmount ?? 0;
  const planTaxAmount = priceBreakdown?.taxAmount ?? 0;
  const planJoiningFee = priceBreakdown?.joiningFee ?? 0;
  const programAmount = priceBreakdown?.finalPrice ?? 0;
  const registrationFee = Number(extended.registrationFee || 0);
  const discount = Number(payment.discount || 0);
  const paymentReceived = Number(payment.amount || 0);
  const totalDue = programAmount + planJoiningFee + registrationFee - discount;
  const pendingAmount = Math.max(totalDue - paymentReceived, 0);
  const amountExceedsTotalDue = paymentReceived > totalDue + 0.005;

  const set = <K extends keyof WizardPaymentState>(key: K, next: WizardPaymentState[K]) => onPaymentChange({ ...payment, [key]: next });

  // Prefills "Payment received" with the computed total once a plan is picked — the
  // common case is paying in full at signup; staff can still edit it down for a
  // partial payment. Only fires while the field is untouched so it never clobbers
  // a manual edit.
  useEffect(() => {
    if (selectedPlan && payment.amount === '' && totalDue > 0) {
      onPaymentChange({ ...payment, amount: totalDue.toFixed(2) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to totalDue settling after a plan pick, not every payment/onPaymentChange identity change
  }, [selectedPlan, totalDue]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border p-4">
        <h3 className="mb-2 text-sm font-medium">Proforma Invoice</h3>
        {row('Name', `${core.firstName} ${core.lastName}`.trim() || '—')}
        {row('Mobile no.', core.phone || '—')}
        {row('E-mail id', core.email || '—')}
        {row('Goal', extended.goal || '—')}
        {row('Program joined', selectedPlan?.name ?? 'No program selected')}
        {selectedPlan ? row('Duration', `${selectedPlan.durationValue} ${selectedPlan.durationType.toLowerCase()}`) : null}
        {row('Plan price', `${currencySymbol}${programBasePrice.toFixed(2)}`)}
        {planDiscountAmount > 0 ? row(`Plan discount (${selectedPlan?.discountPercentage}%)`, `-${currencySymbol}${planDiscountAmount.toFixed(2)}`) : null}
        {planTaxAmount > 0 ? row(`Tax (${selectedPlan?.taxPercentage}%)`, `${currencySymbol}${planTaxAmount.toFixed(2)}`) : null}
        {planJoiningFee > 0 ? row('Plan registration fee', `${currencySymbol}${planJoiningFee.toFixed(2)}`) : null}
        {row('Program amount', `${currencySymbol}${(programAmount + planJoiningFee).toFixed(2)}`)}
        {registrationFee > 0 ? row('Registration fee', `${currencySymbol}${registrationFee.toFixed(2)}`) : null}
        {row('Date of joining', core.joiningDate || '—')}
        {row('Discount allowed', `${currencySymbol}${discount.toFixed(2)}`)}
        {row('Total due', <span className="font-semibold">{currencySymbol}{totalDue.toFixed(2)}</span>)}
        {row('Total payment received', `${currencySymbol}${paymentReceived.toFixed(2)}`)}
        {row('Pending amount', <span className={pendingAmount > 0 ? 'text-destructive' : 'text-emerald-600'}>{currencySymbol}{pendingAmount.toFixed(2)}</span>)}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="paymentReceived">Payment received</Label>
          <Input
            id="paymentReceived"
            type="number"
            min={0}
            max={totalDue > 0 ? totalDue.toFixed(2) : undefined}
            step="0.01"
            value={payment.amount}
            disabled={disabled}
            aria-invalid={amountExceedsTotalDue}
            onChange={(e) => set('amount', e.target.value)}
          />
          {amountExceedsTotalDue ? (
            <p role="alert" className="text-xs text-destructive">
              Cannot exceed the total due of {currencySymbol}{totalDue.toFixed(2)}.
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="discountAllowed">Discount allowed</Label>
          <Input
            id="discountAllowed"
            type="number"
            min={0}
            step="0.01"
            value={payment.discount}
            disabled={disabled}
            onChange={(e) => set('discount', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="transactionMode">Transaction mode</Label>
          <select
            id="transactionMode"
            className={selectClassName}
            value={payment.method}
            disabled={disabled}
            onChange={(e) => set('method', e.target.value)}
          >
            {(Object.keys(METHOD_LABELS) as MemberPaymentMethod[]).map((k) => (
              <option key={k} value={k}>
                {METHOD_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </section>
    </div>
  );
}
