'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';
import { DEFAULT_PLAN_FORM_STATE, PlanFormFields, type PlanFormState } from '@/features/members/components/plan-form-fields';
import {
  toMemberError,
  useDuplicateMembershipPlan,
  useMembershipPlanDetail,
  useMembershipPlanStatusAction,
  useUpdateMembershipPlan,
} from '@/features/members/hooks/use-members';
import type { MembershipPlan } from '@/features/members/types';

type StatusActionKind = 'activate' | 'deactivate' | 'restore' | 'delete';

function toFormState(plan: MembershipPlan): PlanFormState {
  return {
    name: plan.name,
    planCode: plan.planCode,
    description: plan.description ?? '',
    category: plan.category ?? '',
    durationValue: String(plan.durationValue),
    durationType: plan.durationType,
    price: plan.price,
    joiningFee: plan.joiningFee,
    taxPercentage: plan.taxPercentage,
    discountPercentage: plan.discountPercentage,
    displayOrder: String(plan.displayOrder),
    notes: plan.notes ?? '',
    gymAccessAllBranches: plan.gymAccessAllBranches,
    ptSessionsIncluded: String(plan.ptSessionsIncluded),
    groupClassesIncluded: String(plan.groupClassesIncluded),
    dietConsultationIncluded: plan.dietConsultationIncluded,
    lockerAccess: plan.lockerAccess,
    guestPasses: String(plan.guestPasses),
    freezeAllowed: plan.freezeAllowed,
    freezeDaysLimit: plan.freezeDaysLimit === null ? '' : String(plan.freezeDaysLimit),
    validityStart: plan.validityStart ? plan.validityStart.slice(0, 10) : '',
    validityEnd: plan.validityEnd ? plan.validityEnd.slice(0, 10) : '',
    gracePeriodDays: String(plan.gracePeriodDays),
    renewalWindowDays: String(plan.renewalWindowDays),
    autoRenewalAllowed: plan.autoRenewalAllowed,
    minAge: plan.minAge === null ? '' : String(plan.minAge),
    maxAge: plan.maxAge === null ? '' : String(plan.maxAge),
  };
}

function toNumberOrUndefined(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

export default function MembershipPlanDetailPage() {
  const params = useParams<{ planId: string }>();
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const planId = params.planId;

  const plan = useMembershipPlanDetail(planId);
  const updatePlan = useUpdateMembershipPlan();
  const statusAction = useMembershipPlanStatusAction();
  const duplicatePlan = useDuplicateMembershipPlan();

  const canUpdate = hasPermission('memberships:update');
  const canDelete = hasPermission('memberships:delete');
  const canRestore = hasPermission('memberships:restore');
  const canCreate = hasPermission('memberships:create');

  const [form, setForm] = React.useState<PlanFormState | null>(null);
  const [confirmStatusAction, setConfirmStatusAction] = React.useState<StatusActionKind | null>(null);

  React.useEffect(() => {
    if (plan.data && !form) setForm(toFormState(plan.data));
  }, [plan.data, form]);

  if (plan.isPending || !form) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (plan.isError || !plan.data) {
    return <p className="text-sm text-destructive">Couldn&apos;t load this plan — try refreshing.</p>;
  }

  const data = plan.data;
  const baseline = toFormState(data);
  const isDirty = JSON.stringify(form) !== JSON.stringify(DEFAULT_PLAN_FORM_STATE) && JSON.stringify(form) !== JSON.stringify(baseline);

  const handleCancel = () => setForm(baseline);

  const handleSave = () => {
    updatePlan.mutate(
      {
        planId,
        payload: {
          name: form.name,
          planCode: form.planCode || undefined,
          description: form.description || null,
          category: form.category || null,
          durationValue: Number(form.durationValue),
          durationType: form.durationType,
          price: Number(form.price),
          joiningFee: toNumberOrUndefined(form.joiningFee),
          taxPercentage: toNumberOrUndefined(form.taxPercentage),
          discountPercentage: toNumberOrUndefined(form.discountPercentage),
          displayOrder: toNumberOrUndefined(form.displayOrder),
          notes: form.notes || null,
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
      },
      {
        onSuccess: () => toast.success('Plan updated'),
        onError: (err) => toast.error(toMemberError(err).message),
      },
    );
  };

  const runStatusAction = (action: StatusActionKind) => {
    statusAction.mutate(
      { planId, action },
      {
        onSuccess: () => toast.success(`Plan ${action}d.`),
        onError: (err) => toast.error(toMemberError(err).message),
      },
    );
    setConfirmStatusAction(null);
  };

  const handleDuplicate = () => {
    duplicatePlan.mutate(planId, {
      onSuccess: (created) => {
        toast.success(`Duplicated as "${created.name}" (inactive draft).`);
        router.push(`/memberships/${created.id}`);
      },
      onError: (err) => toast.error(toMemberError(err).message),
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/memberships">
          <ArrowLeft className="size-4" /> Back to membership plans
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
          <p className="text-muted-foreground">
            {data.planCode} · {data.memberCount} member(s) on this plan
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.deletedAt ? (
            <Badge variant="outline" className="border-dashed text-muted-foreground">Deleted</Badge>
          ) : (
            <Badge variant={data.isActive ? 'secondary' : 'outline'}>{data.isActive ? 'Active' : 'Inactive'}</Badge>
          )}
          {canCreate ? (
            <Button variant="outline" size="sm" disabled={duplicatePlan.isPending} onClick={handleDuplicate}>
              <Copy className="size-4" /> Duplicate
            </Button>
          ) : null}
          {data.deletedAt ? (
            canRestore ? (
              <Button size="sm" onClick={() => setConfirmStatusAction('restore')}>
                Restore
              </Button>
            ) : null
          ) : canUpdate ? (
            data.isActive ? (
              <Button variant="outline" size="sm" onClick={() => setConfirmStatusAction('deactivate')}>
                Deactivate
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setConfirmStatusAction('activate')}>
                Activate
              </Button>
            )
          ) : null}
          {!data.deletedAt && canDelete ? (
            <Button variant="destructive" size="sm" onClick={() => setConfirmStatusAction('delete')}>
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      {canUpdate ? <UnsavedChangesBar isDirty={isDirty} saving={updatePlan.isPending} onSave={handleSave} onCancel={handleCancel} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan details</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanFormFields value={form} onChange={setForm} disabled={!canUpdate} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmStatusAction !== null}
        onOpenChange={(open) => !open && setConfirmStatusAction(null)}
        title={confirmStatusAction ? `${confirmStatusAction[0]!.toUpperCase()}${confirmStatusAction.slice(1)} "${data.name}"?` : ''}
        description={
          confirmStatusAction === 'delete'
            ? 'This soft-deletes the plan — it can no longer be assigned to members until restored.'
            : 'This action can be reversed later if needed.'
        }
        destructive={confirmStatusAction === 'delete'}
        loading={statusAction.isPending}
        onConfirm={() => confirmStatusAction && runStatusAction(confirmStatusAction)}
      />
    </div>
  );
}
