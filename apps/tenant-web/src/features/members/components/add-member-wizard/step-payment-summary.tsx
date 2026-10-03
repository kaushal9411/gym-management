'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Banknote, Building2, CreditCard, FileText, Info, Smartphone, Wallet, type LucideIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrencySymbol } from '@/lib/currency';
import type { MemberPaymentMethod } from '@/features/finance/types';
import { type Accent, PanelCard, accentVar, formatMoney, tint } from '../detail/detail-ui';
import type { MemberExtendedInfoFormState } from '../member-extended-info-fields';
import type { MemberProgramFormState } from '../member-program-fields';
import type { WizardPaymentState } from './types';
import { useWizardPricing } from './use-wizard-pricing';
import { Notice } from './wizard-ui';

const METHODS: Array<{ value: MemberPaymentMethod; label: string; icon: LucideIcon; accent: Accent }> = [
  { value: 'CASH', label: 'Cash', icon: Banknote, accent: 'success' },
  { value: 'UPI', label: 'UPI', icon: Smartphone, accent: 'primary' },
  { value: 'CREDIT_CARD', label: 'Credit card', icon: CreditCard, accent: 'violet' },
  { value: 'DEBIT_CARD', label: 'Debit card', icon: CreditCard, accent: 'aqua' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer', icon: Building2, accent: 'warning' },
  { value: 'CHEQUE', label: 'Cheque', icon: FileText, accent: 'destructive' },
  { value: 'ONLINE_GATEWAY', label: 'Online gateway', icon: Wallet, accent: 'primary' },
];

interface StepPaymentSummaryProps {
  extended: MemberExtendedInfoFormState;
  program: MemberProgramFormState;
  payment: WizardPaymentState;
  onPaymentChange: (value: WizardPaymentState) => void;
  disabled?: boolean;
}

export function StepPaymentSummary({ extended, program, payment, onPaymentChange, disabled }: StepPaymentSummaryProps) {
  const symbol = useCurrencySymbol();
  const p = useWizardPricing(extended, program, payment);
  const set = <K extends keyof WizardPaymentState>(key: K, next: WizardPaymentState[K]) => onPaymentChange({ ...payment, [key]: next });

  // Prefills "Payment received" with the computed total once a plan is picked — the
  // common case is paying in full at signup; staff can still edit it down for a
  // partial payment. Only fires while the field is untouched so it never clobbers
  // a manual edit.
  useEffect(() => {
    if (p.selectedPlan && payment.amount === '' && p.totalDue > 0) {
      onPaymentChange({ ...payment, amount: p.totalDue.toFixed(2) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to totalDue settling after a plan pick, not every payment/onPaymentChange identity change
  }, [p.selectedPlan, p.totalDue]);

  const quick = [
    { label: `Full ${formatMoney(symbol, Math.max(p.totalDue, 0))}`, value: Math.max(p.totalDue, 0).toFixed(2), show: p.totalDue > 0 },
    { label: 'Half', value: (Math.max(p.totalDue, 0) / 2).toFixed(2), show: p.totalDue > 0 },
    { label: 'Pay later', value: '0', show: true },
  ];

  return (
    <div className="space-y-5">
      <PanelCard icon={Banknote} accent="success" title="Payment" delay={0}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="paymentReceived">Payment received</Label>
            <Input
              id="paymentReceived"
              type="number"
              min={0}
              max={p.totalDue > 0 ? p.totalDue.toFixed(2) : undefined}
              step="0.01"
              value={payment.amount}
              disabled={disabled}
              aria-invalid={p.amountExceedsTotalDue || undefined}
              onChange={(e) => set('amount', e.target.value)}
            />
            {p.amountExceedsTotalDue ? (
              <p role="alert" className="text-xs text-destructive">
                Cannot exceed the total due of {symbol}{p.totalDue.toFixed(2)}.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              {quick.filter((q) => q.show).map((q) => (
                <button
                  key={q.label}
                  type="button"
                  disabled={disabled}
                  onClick={() => set('amount', q.value)}
                  className="rounded-full border px-3 py-1 text-xs font-semibold transition-colors hover:border-[var(--success)] hover:bg-[color-mix(in_oklch,var(--success)_12%,transparent)]"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="discountAllowed">Discount allowed</Label>
            <Input id="discountAllowed" type="number" min={0} step="0.01" value={payment.discount} disabled={disabled} onChange={(e) => set('discount', e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[13px] font-semibold">Transaction mode</p>
          <div role="group" aria-label="Transaction mode" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {METHODS.map((m) => {
              const on = payment.method === m.value;
              return (
                <motion.button
                  key={m.value}
                  type="button"
                  disabled={disabled}
                  aria-pressed={on}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => set('method', m.value)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-[12.5px] font-bold transition-colors disabled:opacity-50"
                  style={on ? { borderColor: accentVar(m.accent), backgroundColor: tint(m.accent, 11), color: accentVar(m.accent) } : undefined}
                >
                  <span className="grid size-9 place-items-center rounded-xl" style={{ backgroundColor: tint(m.accent, 16), color: accentVar(m.accent) }}>
                    <m.icon className="size-[18px]" aria-hidden />
                  </span>
                  {m.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {p.pendingAmount > 0 && p.selectedPlan ? (
          <Notice tone="warning">
            <Info className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--warning)' }} aria-hidden />
            <p>
              <b>{formatMoney(symbol, p.pendingAmount)} will stay pending.</b> It shows as a balance due on the member&apos;s page, where you can send a payment link.
            </p>
          </Notice>
        ) : null}
      </PanelCard>
    </div>
  );
}
