'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_PLAN_FORM_STATE, PlanFormFields, type PlanFormState } from '@/features/members/components/plan-form-fields';
import { toMemberError, useCreateMembershipPlan } from '@/features/members/hooks/use-members';

function toNumberOrUndefined(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

export default function NewMembershipPlanPage() {
  const router = useRouter();
  const createPlan = useCreateMembershipPlan();
  const [form, setForm] = React.useState<PlanFormState>(DEFAULT_PLAN_FORM_STATE);
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.durationValue || !form.price) {
      setError('Name, duration, and price are required.');
      return;
    }
    createPlan.mutate(
      {
        name: form.name,
        planCode: form.planCode || undefined,
        description: form.description || undefined,
        category: form.category || undefined,
        durationValue: Number(form.durationValue),
        durationType: form.durationType,
        price: Number(form.price),
        joiningFee: toNumberOrUndefined(form.joiningFee),
        taxPercentage: toNumberOrUndefined(form.taxPercentage),
        discountPercentage: toNumberOrUndefined(form.discountPercentage),
        displayOrder: toNumberOrUndefined(form.displayOrder),
        notes: form.notes || undefined,
        gymAccessAllBranches: form.gymAccessAllBranches,
        ptSessionsIncluded: toNumberOrUndefined(form.ptSessionsIncluded),
        groupClassesIncluded: toNumberOrUndefined(form.groupClassesIncluded),
        dietConsultationIncluded: form.dietConsultationIncluded,
        lockerAccess: form.lockerAccess,
        guestPasses: toNumberOrUndefined(form.guestPasses),
        freezeAllowed: form.freezeAllowed,
        freezeDaysLimit: toNumberOrUndefined(form.freezeDaysLimit) ?? null,
        validityStart: form.validityStart || null,
        validityEnd: form.validityEnd || null,
        gracePeriodDays: toNumberOrUndefined(form.gracePeriodDays),
        renewalWindowDays: toNumberOrUndefined(form.renewalWindowDays),
        autoRenewalAllowed: form.autoRenewalAllowed,
        minAge: toNumberOrUndefined(form.minAge) ?? null,
        maxAge: toNumberOrUndefined(form.maxAge) ?? null,
      },
      {
        onSuccess: (plan) => {
          toast.success(`${plan.name} created`);
          router.push(`/memberships/${plan.id}`);
        },
        onError: (err) => setError(toMemberError(err).message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/memberships">
          <ArrowLeft className="size-4" /> Back to membership plans
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create a membership plan</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <PlanFormFields value={form} onChange={setForm} disabled={createPlan.isPending} />
            <Button type="submit" className="w-full" disabled={createPlan.isPending}>
              {createPlan.isPending ? 'Creating…' : 'Create plan'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
