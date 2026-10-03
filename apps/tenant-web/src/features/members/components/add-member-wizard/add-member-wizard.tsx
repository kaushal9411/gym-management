'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useBranches } from '@/features/branch/hooks/use-branches';
import { toFinanceError, useCreatePayment } from '@/features/finance/hooks/use-finance';
import type { MemberPaymentMethod } from '@/features/finance/types';
import { DEFAULT_MEMBER_EXTENDED_INFO_FORM_STATE, type MemberExtendedInfoFormState } from '../member-extended-info-fields';
import { DEFAULT_MEMBER_HEALTH_FORM_STATE, type MemberHealthFormState } from '../member-health-screening-fields';
import { DEFAULT_MEMBER_PROGRAM_FORM_STATE, type MemberProgramFormState } from '../member-program-fields';
import { toMemberError, useAssignMembership, useAssignablePlans, useCreateMember } from '../../hooks/use-members';
import { computePlanPrice } from '../../utils/plan-pricing';
import { StepHealthScreening } from './step-health-screening';
import { StepPaymentSummary } from './step-payment-summary';
import { StepPersonalInfo } from './step-personal-info';
import { composeDateOfBirth, defaultWizardCorePersonalState, defaultWizardPaymentState, type WizardCorePersonalState, type WizardPaymentState } from './types';
import { WizardAside } from './wizard-aside';
import { WizardHero } from './wizard-progress';

export function AddMemberWizard() {
  const router = useRouter();
  const createMember = useCreateMember();
  const assignMembership = useAssignMembership();
  const createPayment = useCreatePayment();
  const plans = useAssignablePlans();

  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [core, setCore] = React.useState<WizardCorePersonalState>(defaultWizardCorePersonalState());
  const [extended, setExtended] = React.useState<MemberExtendedInfoFormState>(DEFAULT_MEMBER_EXTENDED_INFO_FORM_STATE);
  const [program, setProgram] = React.useState<MemberProgramFormState>(DEFAULT_MEMBER_PROGRAM_FORM_STATE);
  const [health, setHealth] = React.useState<MemberHealthFormState>(DEFAULT_MEMBER_HEALTH_FORM_STATE);
  const [payment, setPayment] = React.useState<WizardPaymentState>(defaultWizardPaymentState());
  const [error, setError] = React.useState<string | null>(null);
  const [showErrors, setShowErrors] = React.useState(false);
  const branches = useBranches();

  const submitting = createMember.isPending || assignMembership.isPending || createPayment.isPending;

  function goNext() {
    setError(null);
    if (step === 1) {
      const problem = !core.firstName.trim() || !core.lastName.trim()
        ? 'Enter the member’s full name.'
        : !core.phone.trim() && !core.email.trim()
          ? 'Enter a phone number or email address.'
          : !core.branchId
            ? 'Select a branch.'
            : !core.joiningDate
              ? 'Select a date of joining.'
              : null;
      if (problem) {
        setShowErrors(true);
        setError(problem);
        return;
      }
    }
    setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  }

  function goBack() {
    setError(null);
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
  }

  async function handleFinalSubmit() {
    setError(null);

    const amountTyped = Number(payment.amount || 0);
    const selectedPlan = plans.data?.find((p) => p.id === program.planId) ?? null;
    const priceBreakdown = selectedPlan ? computePlanPrice(selectedPlan) : null;
    const registrationFee = Number(extended.registrationFee || 0);
    const manualDiscount = Number(payment.discount || 0);
    const totalDue = (priceBreakdown?.finalPrice ?? 0) + (priceBreakdown?.joiningFee ?? 0) + registrationFee - manualDiscount;

    if (amountTyped > totalDue + 0.005) {
      setError(`Payment received cannot exceed the total due of ${totalDue.toFixed(2)}.`);
      setStep(3);
      return;
    }

    let memberId: string;
    let memberName: string;
    try {
      const member = await createMember.mutateAsync({
        firstName: core.firstName,
        lastName: core.lastName,
        email: core.email || undefined,
        phone: core.phone || undefined,
        memberId: core.memberId || undefined,
        gender: core.gender || undefined,
        dateOfBirth: composeDateOfBirth(core),
        height: core.height ? Number(core.height) : undefined,
        weight: core.weight ? Number(core.weight) : undefined,
        occupation: core.occupation || undefined,
        addressLine: core.addressLine || undefined,
        city: core.city || undefined,
        state: core.state || undefined,
        country: core.country || undefined,
        postalCode: core.postalCode || undefined,
        joiningDate: core.joiningDate || undefined,
        branchId: core.branchId,
        trainerId: core.trainerId || undefined,
        fatherNameOrAadhaar: extended.fatherNameOrAadhaar || undefined,
        maritalStatus: extended.maritalStatus || undefined,
        anniversary: extended.anniversary || undefined,
        goal: extended.goal || undefined,
        registrationFee: extended.registrationFee ? Number(extended.registrationFee) : undefined,
        bodyType: extended.bodyType || undefined,
        foodPreference: extended.foodPreference || undefined,
        healthHeartCondition: health.healthHeartCondition,
        healthPainDuringActivity: health.healthPainDuringActivity,
        healthDizzinessOrBalance: health.healthDizzinessOrBalance,
        healthDiabetesOrBp: health.healthDiabetesOrBp,
        healthAsthma: health.healthAsthma,
        healthBoneOrJointProblem: health.healthBoneOrJointProblem,
        healthOtherCondition: health.healthOtherCondition,
        awarenessSource: health.awarenessSource || undefined,
        healthScreeningOtherDetails: health.healthScreeningOtherDetails || undefined,
        referredByMemberId: health.referredByMemberId || undefined,
        bloodGroup: health.bloodGroup || undefined,
      });
      memberId = member.id;
      memberName = member.name;
    } catch (err) {
      setError(toMemberError(err).message);
      return;
    }

    // The member now exists — every failure from here on must land the user
    // on the member's own page rather than silently losing the rest.
    let membershipId: string | undefined;
    if (program.planId) {
      try {
        const updated = await assignMembership.mutateAsync({
          id: memberId,
          payload: {
            planId: program.planId,
            startDate: program.startDate || undefined,
            targetWeight: program.targetWeight ? Number(program.targetWeight) : undefined,
          },
        });
        membershipId = updated.membershipHistory[0]?.id;
      } catch (err) {
        toast.error(`Member created, but plan assignment failed: ${toMemberError(err).message}. Finish it from the member's page.`);
        router.push(`/members/${memberId}`);
        return;
      }
    }

    if (amountTyped > 0) {
      const grossBase = (priceBreakdown?.basePrice ?? 0) + (priceBreakdown?.joiningFee ?? 0) + registrationFee;

      // Paying the full balance: send the itemizable breakdown (plan price, plan
      // discount/tax, registration fee all folded into amount/discount/tax) so the
      // auto-generated invoice shows the real detail instead of one flat number.
      // A partial payment (staff typed less than the total due) falls back to the
      // literal pre-existing behavior — just what was typed, no plan-level
      // discount/tax applied — since a partial amount can't be cleanly decomposed
      // without guessing how much of the shortfall is "pre-tax" vs "pre-discount".
      const isFullPayment = priceBreakdown !== null && amountTyped >= totalDue - 0.005;
      const paymentPayload = isFullPayment
        ? {
            amount: grossBase,
            discount: (priceBreakdown?.discountAmount ?? 0) + manualDiscount,
            tax: priceBreakdown?.taxAmount ?? 0,
          }
        : { amount: amountTyped, discount: manualDiscount };

      try {
        await createPayment.mutateAsync({
          memberId,
          membershipId,
          ...paymentPayload,
          method: payment.method as MemberPaymentMethod,
          status: 'SUCCESS',
        });
      } catch (err) {
        toast.error(`Member created, but payment recording failed: ${toFinanceError(err).message}. Record it from the member's page.`);
        router.push(`/members/${memberId}`);
        return;
      }
    }

    toast.success(`${memberName} created`);
    router.push(`/members/${memberId}`);
  }

  const branchName = branches.data?.find((b) => b.id === core.branchId)?.name;

  return (
    <div className="space-y-5">
      <WizardHero
        current={step}
        onStepClick={(n) => {
          setError(null);
          setStep(n);
        }}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="space-y-5"
            >
              {error ? (
                <motion.p role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                  {error}
                </motion.p>
              ) : null}

              {step === 1 ? (
                <StepPersonalInfo core={core} onCoreChange={setCore} extended={extended} onExtendedChange={setExtended} program={program} onProgramChange={setProgram} showErrors={showErrors} disabled={submitting} />
              ) : step === 2 ? (
                <StepHealthScreening value={health} onChange={setHealth} disabled={submitting} />
              ) : (
                <StepPaymentSummary extended={extended} program={program} payment={payment} onPaymentChange={setPayment} disabled={submitting} />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="sticky bottom-3 z-10 flex justify-between gap-3 rounded-2xl border bg-card/95 p-3.5 shadow-lg backdrop-blur">
            <Button type="button" variant="outline" disabled={step === 1 || submitting} onClick={goBack}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            {step < 3 ? (
              <Button type="button" onClick={goNext} disabled={submitting} className="border-0 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--primary), var(--chart-7))' }}>
                Next <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleFinalSubmit} disabled={submitting} className="border-0 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' }}>
                <Check className="size-4" /> {submitting ? 'Saving…' : 'Create member'}
              </Button>
            )}
          </div>
        </div>

        <WizardAside core={core} extended={extended} program={program} payment={payment} branchName={branchName} />
      </div>
    </div>
  );
}
