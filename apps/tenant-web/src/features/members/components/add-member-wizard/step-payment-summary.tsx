'use client';

import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useCurrencySymbol } from '@/lib/currency';
import type { MemberPaymentMethod } from '@/features/finance/types';
import { useAssignablePlans } from '../../hooks/use-members';
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

  const programAmount = selectedPlan ? Number(selectedPlan.price) : 0;
  const registrationFee = Number(extended.registrationFee || 0);
  const discount = Number(payment.discount || 0);
  const paymentReceived = Number(payment.amount || 0);
  const totalDue = programAmount + registrationFee - discount;
  const pendingAmount = Math.max(totalDue - paymentReceived, 0);

  const set = <K extends keyof WizardPaymentState>(key: K, next: WizardPaymentState[K]) => onPaymentChange({ ...payment, [key]: next });

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
        {row('Program amount', `${currencySymbol}${programAmount.toFixed(2)}`)}
        {registrationFee > 0 ? row('Registration fee', `${currencySymbol}${registrationFee.toFixed(2)}`) : null}
        {row('Date of joining', core.joiningDate || '—')}
        {row('Discount allowed', `${currencySymbol}${discount.toFixed(2)}`)}
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
            step="0.01"
            value={payment.amount}
            disabled={disabled}
            onChange={(e) => set('amount', e.target.value)}
          />
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
