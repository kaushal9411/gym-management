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
import { PanelCard } from '@/features/members/components/detail/detail-ui';
import type { MemberListItem } from '@/features/members/types';
import {
  DEFAULT_WORKOUT_PLAN_FORM_STATE,
  WorkoutPlanFormFields,
  type WorkoutPlanFormState,
} from '@/features/workouts/components/workout-plan-form-fields';
import { WorkoutPlanDetailHero } from '@/features/workouts/components/workout-plan-detail-hero';
import { WeeklyScheduleEditor } from '@/features/workouts/components/weekly-schedule-editor';
import {
  toWorkoutError,
  useActiveExercises,
  useAssignWorkoutPlan,
  useDuplicateWorkoutPlan,
  useSetPlanExercises,
  useUpdateWorkoutPlan,
  useWorkoutPlan,
  useWorkoutPlanStatusAction,
} from '@/features/workouts/hooks/use-workouts';
import type { PlanExerciseInput, WorkoutPlanDetail } from '@/features/workouts/types';

type StatusActionKind = 'activate' | 'deactivate' | 'restore' | 'delete';

function toFormState(plan: WorkoutPlanDetail): WorkoutPlanFormState {
  return {
    name: plan.name,
    description: plan.description ?? '',
    goal: plan.goal ?? '',
    level: plan.level,
    durationWeeks: String(plan.durationWeeks),
    trainerId: plan.trainer?.id ?? '',
    isActive: plan.isActive,
    notes: plan.notes ?? '',
  };
}

/** Same hero + PanelCard-sections shell as the Branch/Membership detail pages — every field/handler/mutation below is exactly as before, only the wrapping layout changed. */
export default function WorkoutPlanDetailPage() {
  const params = useParams<{ planId: string }>();
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const planId = params.planId;

  const plan = useWorkoutPlan(planId);
  const exercises = useActiveExercises();
  const updatePlan = useUpdateWorkoutPlan();
  const setExercises = useSetPlanExercises();
  const statusAction = useWorkoutPlanStatusAction();
  const duplicatePlan = useDuplicateWorkoutPlan();
  const assignPlan = useAssignWorkoutPlan();

  const canUpdate = hasPermission('workouts:update');
  const canDelete = hasPermission('workouts:delete');
  const canRestore = hasPermission('workouts:restore');
  const canCreate = hasPermission('workouts:create');
  const canAssign = hasPermission('workouts:assign');

  const [form, setForm] = React.useState<WorkoutPlanFormState | null>(null);
  const [confirmStatusAction, setConfirmStatusAction] = React.useState<StatusActionKind | null>(null);
  const [scheduleExercises, setScheduleExercises] = React.useState<PlanExerciseInput[]>([]);
  const [scheduleDirty, setScheduleDirty] = React.useState(false);
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
  const isDirty = JSON.stringify(form) !== JSON.stringify(DEFAULT_WORKOUT_PLAN_FORM_STATE) && JSON.stringify(form) !== JSON.stringify(baseline);

  const handleCancel = () => setForm(baseline);

  const handleSave = () => {
    updatePlan.mutate(
      {
        id: planId,
        payload: {
          name: form.name,
          description: form.description || undefined,
          goal: form.goal || undefined,
          level: form.level,
          durationWeeks: Number(form.durationWeeks),
          trainerId: form.trainerId || undefined,
          isActive: form.isActive,
          notes: form.notes || undefined,
        },
      },
      {
        onSuccess: () => toast.success('Plan updated'),
        onError: (err) => toast.error(toWorkoutError(err).message),
      },
    );
  };

  const handleSaveSchedule = () => {
    setExercises.mutate(
      { id: planId, exercises: scheduleExercises },
      {
        onSuccess: () => {
          toast.success('Weekly schedule saved.');
          setScheduleDirty(false);
        },
        onError: (err) => toast.error(toWorkoutError(err).message),
      },
    );
  };

  const runStatusAction = (action: StatusActionKind) => {
    statusAction.mutate(
      { id: planId, action },
      {
        onSuccess: () => toast.success(`Plan ${action}d.`),
        onError: (err) => toast.error(toWorkoutError(err).message),
      },
    );
    setConfirmStatusAction(null);
  };

  const handleDuplicate = () => {
    duplicatePlan.mutate(planId, {
      onSuccess: (created) => {
        toast.success(`Duplicated as "${created.name}" (inactive draft).`);
        router.push(`/workout-plans/${created.id}`);
      },
      onError: (err) => toast.error(toWorkoutError(err).message),
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
        onError: (err) => toast.error(toWorkoutError(err).message),
      },
    );
  };

  return (
    <div className="w-full space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/workout-plans">
          <ArrowLeft className="size-4" /> Back to workout plans
        </Link>
      </Button>

      <WorkoutPlanDetailHero
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

      <WorkoutPlanFormFields value={form} onChange={setForm} disabled={!canUpdate} />

      <PanelCard icon={ListChecks} accent="violet" title="Weekly schedule" delay={0.05}>
        <WeeklyScheduleEditor
          initialExercises={data.exercises}
          exerciseOptions={exercises.data ?? []}
          disabled={!canUpdate}
          onChange={(next, dirty) => {
            setScheduleExercises(next);
            setScheduleDirty(dirty);
          }}
        />
        {canUpdate ? (
          <Button
            size="sm"
            disabled={!scheduleDirty || setExercises.isPending}
            onClick={handleSaveSchedule}
            className="border-0 text-white shadow-md disabled:opacity-50"
            style={{ backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' }}
          >
            {setExercises.isPending ? 'Saving…' : 'Save weekly schedule'}
          </Button>
        ) : null}
      </PanelCard>

      {canAssign && !data.deletedAt && data.isActive ? (
        <PanelCard icon={UserPlus} accent="aqua" title="Assign to a member" delay={0.1}>
          <MemberCheckinSearch onSelect={setAssignMember} placeholder="Search member by name, email, or member ID…" />
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
