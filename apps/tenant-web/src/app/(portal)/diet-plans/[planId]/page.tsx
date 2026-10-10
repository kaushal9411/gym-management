'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Copy, ListChecks, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';
import { MemberCheckinSearch } from '@/features/attendance/components/member-checkin-search';
import type { MemberListItem } from '@/features/members/types';
import {
  DEFAULT_DIET_PLAN_FORM_STATE,
  DietPlanFormFields,
  type DietPlanFormState,
} from '@/features/diet/components/diet-plan-form-fields';
import { DietPlanDetailHero } from '@/features/diet/components/diet-plan-detail-hero';
import { MealBuilder } from '@/features/diet/components/meal-builder';
import {
  toDietError,
  useActiveFoods,
  useAssignDietPlan,
  useDietPlan,
  useDietPlanStatusAction,
  useDuplicateDietPlan,
  useSetPlanMeals,
  useUpdateDietPlan,
} from '@/features/diet/hooks/use-diet';
import type { DietPlanDetail, PlanMealInput } from '@/features/diet/types';
import { PanelCard } from '@/features/members/components/detail/detail-ui';

type StatusActionKind = 'activate' | 'deactivate' | 'restore' | 'delete';

function toFormState(plan: DietPlanDetail): DietPlanFormState {
  return {
    name: plan.name,
    description: plan.description ?? '',
    goal: plan.goal ?? '',
    dailyCalories: plan.dailyCalories === null ? '' : String(plan.dailyCalories),
    durationDays: String(plan.durationDays),
    trainerId: plan.trainer?.id ?? '',
    isActive: plan.isActive,
    notes: plan.notes ?? '',
  };
}

/** Same hero + PanelCard-sections shell as the Workout Plan/Branch detail pages — every field/handler/mutation below is exactly as before, only the wrapping layout changed. */
export default function DietPlanDetailPage() {
  const params = useParams<{ planId: string }>();
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const planId = params.planId;

  const plan = useDietPlan(planId);
  const foods = useActiveFoods();
  const updatePlan = useUpdateDietPlan();
  const setMeals = useSetPlanMeals();
  const statusAction = useDietPlanStatusAction();
  const duplicatePlan = useDuplicateDietPlan();
  const assignPlan = useAssignDietPlan();

  const canUpdate = hasPermission('diets:update');
  const canDelete = hasPermission('diets:delete');
  const canRestore = hasPermission('diets:restore');
  const canCreate = hasPermission('diets:create');
  const canAssign = hasPermission('diets:assign');

  const [form, setForm] = React.useState<DietPlanFormState | null>(null);
  const [confirmStatusAction, setConfirmStatusAction] = React.useState<StatusActionKind | null>(null);
  const [builderMeals, setBuilderMeals] = React.useState<PlanMealInput[]>([]);
  const [mealsDirty, setMealsDirty] = React.useState(false);
  const [assignMember, setAssignMember] = React.useState<MemberListItem | null>(null);
  const [assignStartDate, setAssignStartDate] = React.useState(() => new Date().toISOString().slice(0, 10));

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
  const isDirty = JSON.stringify(form) !== JSON.stringify(DEFAULT_DIET_PLAN_FORM_STATE) && JSON.stringify(form) !== JSON.stringify(baseline);

  const handleCancel = () => setForm(baseline);

  const handleSave = () => {
    updatePlan.mutate(
      {
        id: planId,
        payload: {
          name: form.name,
          description: form.description || undefined,
          goal: form.goal || undefined,
          dailyCalories: form.dailyCalories ? Number(form.dailyCalories) : undefined,
          durationDays: Number(form.durationDays),
          trainerId: form.trainerId || undefined,
          isActive: form.isActive,
          notes: form.notes || undefined,
        },
      },
      {
        onSuccess: () => toast.success('Plan updated'),
        onError: (err) => toast.error(toDietError(err).message),
      },
    );
  };

  const handleSaveMeals = () => {
    setMeals.mutate(
      { id: planId, meals: builderMeals },
      {
        onSuccess: () => {
          toast.success('Meal builder saved.');
          setMealsDirty(false);
        },
        onError: (err) => toast.error(toDietError(err).message),
      },
    );
  };

  const runStatusAction = (action: StatusActionKind) => {
    statusAction.mutate(
      { id: planId, action },
      {
        onSuccess: () => toast.success(`Plan ${action}d.`),
        onError: (err) => toast.error(toDietError(err).message),
      },
    );
    setConfirmStatusAction(null);
  };

  const handleDuplicate = () => {
    duplicatePlan.mutate(planId, {
      onSuccess: (created) => {
        toast.success(`Duplicated as "${created.name}" (inactive draft).`);
        router.push(`/diet-plans/${created.id}`);
      },
      onError: (err) => toast.error(toDietError(err).message),
    });
  };

  const handleAssign = () => {
    if (!assignMember) return;
    assignPlan.mutate(
      { planId, payload: { memberId: assignMember.id, startDate: assignStartDate } },
      {
        onSuccess: () => {
          toast.success(`Assigned to ${assignMember.name}.`);
          setAssignMember(null);
        },
        onError: (err) => toast.error(toDietError(err).message),
      },
    );
  };

  return (
    <div className="w-full space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/diet-plans">
          <ArrowLeft className="size-4" /> Back to diet plans
        </Link>
      </Button>

      <DietPlanDetailHero
        data={data}
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

      <DietPlanFormFields value={form} onChange={setForm} disabled={!canUpdate} />

      <PanelCard icon={ListChecks} accent="violet" title="Meal builder" delay={0.05}>
        <MealBuilder
          initialMeals={data.meals}
          foodOptions={foods.data ?? []}
          disabled={!canUpdate}
          onChange={(next, dirty) => {
            setBuilderMeals(next);
            setMealsDirty(dirty);
          }}
        />
        {canUpdate ? (
          <Button
            size="sm"
            disabled={!mealsDirty || setMeals.isPending}
            onClick={handleSaveMeals}
            className="border-0 text-white shadow-md disabled:opacity-50"
            style={{ backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' }}
          >
            {setMeals.isPending ? 'Saving…' : 'Save meal builder'}
          </Button>
        ) : null}
      </PanelCard>

      {canAssign && !data.deletedAt && data.isActive ? (
        <PanelCard icon={UserPlus} accent="aqua" title="Assign to a member" delay={0.1}>
          <MemberCheckinSearch inline onSelect={setAssignMember} placeholder="Search member by name, email, or member ID…" />
          {assignMember ? (
            <div className="flex flex-wrap items-end gap-2">
              <span className="text-sm">
                Assigning to <span className="font-medium">{assignMember.name}</span>
              </span>
              <div className="space-y-1">
                <Label htmlFor="assignStartDate" className="text-xs">
                  Start date
                </Label>
                <Input id="assignStartDate" type="date" className="h-9" value={assignStartDate} onChange={(e) => setAssignStartDate(e.target.value)} />
              </div>
              <Button
                size="sm"
                disabled={assignPlan.isPending}
                onClick={handleAssign}
                className="border-0 text-white shadow-md disabled:opacity-50"
                style={{ backgroundImage: 'linear-gradient(120deg, var(--primary), var(--chart-7))' }}
              >
                {assignPlan.isPending ? 'Assigning…' : 'Assign plan'}
              </Button>
            </div>
          ) : null}
        </PanelCard>
      ) : null}

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
