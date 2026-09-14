'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toFinanceError, useCreatePayment } from '@/features/finance/hooks/use-finance';
import type { MemberPaymentMethod } from '@/features/finance/types';
import { DEFAULT_MEMBER_EXTENDED_INFO_FORM_STATE, type MemberExtendedInfoFormState } from '../member-extended-info-fields';
import { DEFAULT_MEMBER_HEALTH_FORM_STATE, type MemberHealthFormState } from '../member-health-screening-fields';
import { DEFAULT_MEMBER_PROGRAM_FORM_STATE, type MemberProgramFormState } from '../member-program-fields';
import { toMemberError, useAssignMembership, useCreateMember } from '../../hooks/use-members';
import { StepHealthScreening } from './step-health-screening';
import { StepPaymentSummary } from './step-payment-summary';
import { StepPersonalInfo } from './step-personal-info';
import { composeDateOfBirth, defaultWizardCorePersonalState, defaultWizardPaymentState, type WizardCorePersonalState, type WizardPaymentState } from './types';
import { WizardProgress } from './wizard-progress';

export function AddMemberWizard() {
  const router = useRouter();
  const createMember = useCreateMember();
  const assignMembership = useAssignMembership();
  const createPayment = useCreatePayment();

  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [core, setCore] = React.useState<WizardCorePersonalState>(defaultWizardCorePersonalState());
  const [extended, setExtended] = React.useState<MemberExtendedInfoFormState>(DEFAULT_MEMBER_EXTENDED_INFO_FORM_STATE);
  const [program, setProgram] = React.useState<MemberProgramFormState>(DEFAULT_MEMBER_PROGRAM_FORM_STATE);
  const [health, setHealth] = React.useState<MemberHealthFormState>(DEFAULT_MEMBER_HEALTH_FORM_STATE);
  const [payment, setPayment] = React.useState<WizardPaymentState>(defaultWizardPaymentState());
  const [error, setError] = React.useState<string | null>(null);

  const submitting = createMember.isPending || assignMembership.isPending || createPayment.isPending;

  function goNext() {
    setError(null);
    if (step === 1) {
      if (!core.firstName.trim() || !core.lastName.trim()) {
        setError('Enter the member’s full name.');
        return;
      }
      if (!core.phone.trim() && !core.email.trim()) {
        setError('Enter a phone number or email address.');
        return;
      }
      if (!core.branchId) {
        setError('Select a branch.');
        return;
      }
      if (!core.joiningDate) {
        setError('Select a date of joining.');
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

    const amount = Number(payment.amount || 0);
    if (amount > 0) {
      try {
        await createPayment.mutateAsync({
          memberId,
          membershipId,
          amount,
          discount: Number(payment.discount || 0),
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

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <WizardProgress current={step} />
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        {step === 1 ? (
          <StepPersonalInfo core={core} onCoreChange={setCore} extended={extended} onExtendedChange={setExtended} program={program} onProgramChange={setProgram} disabled={submitting} />
        ) : step === 2 ? (
          <StepHealthScreening value={health} onChange={setHealth} disabled={submitting} />
        ) : (
          <StepPaymentSummary core={core} extended={extended} program={program} payment={payment} onPaymentChange={setPayment} disabled={submitting} />
        )}

        <div className="flex justify-between border-t pt-4">
          <Button type="button" variant="outline" disabled={step === 1 || submitting} onClick={goBack}>
            Back
          </Button>
          {step < 3 ? (
            <Button type="button" onClick={goNext} disabled={submitting}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={handleFinalSubmit} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
