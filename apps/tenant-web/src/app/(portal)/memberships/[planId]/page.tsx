'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';
import { MembershipPlanDetailHero } from '@/features/members/components/membership-plan-detail-hero';
import { DEFAULT_PLAN_FORM_STATE, PlanFormFields, type PlanFormState } from '@/features/members/components/plan-form-fields';
import {
  toMemberError,
  useDuplicateMembershipPlan,
  useMembershipPlanDetail,
  useMembershipPlanStatusAction,
  useUpdateMembershipPlan,
} from '@/features/members/hooks/use-members';
import type { MembershipPlan } from '@/features/members/types';
import { useCurrencySymbol } from '@/lib/currency';

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
  };
}

function toNumberOrUndefined(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

/** Same hero + PanelCard-sections shell as the Branch detail page — every field/handler/mutation below is exactly as before, only the wrapping layout changed. */
export default function MembershipPlanDetailPage() {
  const params = useParams<{ planId: string }>();
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const planId = params.planId;
  const currencySymbol = useCurrencySymbol();

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
      <div className="w-full space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
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
    <div className="w-full space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/memberships">
          <ArrowLeft className="size-4" /> Back to membership plans
        </Link>
      </Button>

      <MembershipPlanDetailHero
        data={data}
        currencySymbol={currencySymbol}
        actions={
          <>
            {canCreate ? (
              <Button variant="secondary" size="sm" disabled={duplicatePlan.isPending} onClick={handleDuplicate}>
                <Copy className="size-4" /> Duplicate
              </Button>
            ) : null}
            {data.deletedAt ? (
              canRestore ? (
                <Button variant="secondary" size="sm" onClick={() => setConfirmStatusAction('restore')}>
                  Restore
                </Button>
              ) : null
            ) : canUpdate ? (
              data.isActive ? (
                <Button variant="secondary" size="sm" onClick={() => setConfirmStatusAction('deactivate')}>
                  Deactivate
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setConfirmStatusAction('activate')}>
                  Activate
                </Button>
              )
            ) : null}
            {!data.deletedAt && canDelete ? (
              <Button variant="destructive" size="sm" onClick={() => setConfirmStatusAction('delete')}>
                Delete
              </Button>
            ) : null}
          </>
        }
      />

      {canUpdate ? <UnsavedChangesBar isDirty={isDirty} saving={updatePlan.isPending} onSave={handleSave} onCancel={handleCancel} /> : null}

      <PlanFormFields value={form} onChange={setForm} disabled={!canUpdate} />

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
