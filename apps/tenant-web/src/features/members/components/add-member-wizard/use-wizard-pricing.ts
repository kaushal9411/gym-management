'use client';

import { useAssignablePlans } from '../../hooks/use-members';
import { computePlanPrice } from '../../utils/plan-pricing';
import type { MemberExtendedInfoFormState } from '../member-extended-info-fields';
import type { MemberProgramFormState } from '../member-program-fields';
import type { WizardPaymentState } from './types';

/** One place for the running price: the sidebar invoice, the payment step and its validation all read it, so they can never disagree. */
export function useWizardPricing(extended: MemberExtendedInfoFormState, program: MemberProgramFormState, payment: WizardPaymentState) {
  const plans = useAssignablePlans();
  const selectedPlan = plans.data?.find((p) => p.id === program.planId) ?? null;
  const breakdown = selectedPlan ? computePlanPrice(selectedPlan) : null;

  const basePrice = breakdown?.basePrice ?? 0;
  const planDiscountAmount = breakdown?.discountAmount ?? 0;
  const planTaxAmount = breakdown?.taxAmount ?? 0;
  const planJoiningFee = breakdown?.joiningFee ?? 0;
  const programAmount = breakdown?.finalPrice ?? 0;
  const registrationFee = Number(extended.registrationFee || 0);
  const discount = Number(payment.discount || 0);
  const paymentReceived = Number(payment.amount || 0);
  const totalDue = programAmount + planJoiningFee + registrationFee - discount;
  const pendingAmount = Math.max(totalDue - paymentReceived, 0);

  return {
    plans,
    selectedPlan,
    basePrice,
    planDiscountAmount,
    planTaxAmount,
    planJoiningFee,
    programAmount,
    registrationFee,
    discount,
    paymentReceived,
    totalDue,
    pendingAmount,
    amountExceedsTotalDue: paymentReceived > totalDue + 0.005,
  };
}
