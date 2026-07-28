'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { DietPlanSelect } from './diet-plan-select';
import { DietAssignmentStatusBadge, DietProgressBadge } from './diet-badges';
import {
  toDietError,
  useAssignDietPlan,
  useMemberDietPlans,
  useRemoveDietAssignment,
  useUpdateDietProgress,
} from '../hooks/use-diet';
import type { MealType } from '../types';

const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  MORNING_SNACK: 'Morning Snack',
  LUNCH: 'Lunch',
  EVENING_SNACK: 'Evening Snack',
  DINNER: 'Dinner',
  PRE_WORKOUT: 'Pre Workout',
  POST_WORKOUT: 'Post Workout',
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface MemberDietCardProps {
  memberId: string;
}

export function MemberDietCard({ memberId }: MemberDietCardProps) {
  const { hasPermission } = usePermissions();
  const canAssign = hasPermission('diets:assign');
  const canProgress = hasPermission('diets:progress');

  const data = useMemberDietPlans(memberId);
  const assign = useAssignDietPlan();
  const remove = useRemoveDietAssignment();
  const updateProgress = useUpdateDietProgress();

  const [planId, setPlanId] = React.useState('');
  const [startDate, setStartDate] = React.useState(todayStr);
  const [waterIntake, setWaterIntake] = React.useState('');
  const [weight, setWeight] = React.useState('');

  const current = data.data?.current ?? null;
  const history = data.data?.history ?? [];
  const today = todayStr();
  const todayLog = current?.dailyLogs.find((log) => log.date === today);

  React.useEffect(() => {
    setWaterIntake(todayLog?.waterIntakeMl ? String(todayLog.waterIntakeMl) : '');
    setWeight(todayLog?.weightKg ?? '');
    // Only re-sync when the active assignment itself changes, not on every log update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const handleAssign = () => {
    if (!planId) return;
    assign.mutate(
      { planId, payload: { memberId, startDate } },
      {
        onSuccess: () => {
          toast.success('Diet plan assigned.');
          setPlanId('');
        },
        onError: (err) => toast.error(toDietError(err).message),
      },
    );
  };

  const handleRemove = () => {
    if (!current) return;
    remove.mutate(current.id, {
      onSuccess: () => toast.success('Diet plan removed.'),
      onError: (err) => toast.error(toDietError(err).message),
    });
  };

  const handleMealStatus = (mealType: MealType, status: 'COMPLETED' | 'SKIPPED') => {
    if (!current) return;
    updateProgress.mutate(
      { assignmentId: current.id, payload: { date: today, mealsStatus: { [mealType]: status } } },
      { onError: (err) => toast.error(toDietError(err).message) },
    );
  };

  const handleSaveDaily = () => {
    if (!current) return;
    updateProgress.mutate(
      {
        assignmentId: current.id,
        payload: {
          date: today,
          waterIntakeMl: waterIntake ? Number(waterIntake) : undefined,
          weightKg: weight ? Number(weight) : undefined,
        },
      },
      {
        onSuccess: () => toast.success('Daily tracking saved.'),
        onError: (err) => toast.error(toDietError(err).message),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Diet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : current ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                On{' '}
                <Link href={`/diet-plans/${current.dietPlan.id}`} className="font-medium hover:underline">
                  {current.dietPlan.name}
                </Link>{' '}
                — {current.dietPlan.durationDays}d{current.dietPlan.dailyCalories ? `, ${current.dietPlan.dailyCalories} kcal/day` : ''}
              </p>
              {canAssign ? (
                <Button size="sm" variant="outline" disabled={remove.isPending} onClick={handleRemove}>
                  {remove.isPending ? 'Removing…' : 'Remove'}
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Started {new Date(current.startDate).toLocaleDateString()}
              {current.endDate ? ` – ${new Date(current.endDate).toLocaleDateString()}` : ''} · {current.progressPercent}% adherence (
              {current.daysLogged} day{current.daysLogged === 1 ? '' : 's'} logged)
              {current.latestWeightKg ? ` · latest weight ${current.latestWeightKg}kg` : ''}
            </p>

            {canProgress ? (
              <div className="space-y-3 rounded-xl border bg-muted/20 p-3.5 shadow-xs">
                <h4 className="text-sm font-semibold text-foreground/90">Today&apos;s tracking ({today})</h4>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="dietWaterIntake" className="text-xs">
                      Water intake (ml)
                    </Label>
                    <Input id="dietWaterIntake" type="number" min={0} className="h-9 w-32" value={waterIntake} onChange={(e) => setWaterIntake(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dietWeight" className="text-xs">
                      Weight (kg)
                    </Label>
                    <Input id="dietWeight" type="number" min={0} step="0.1" className="h-9 w-32" value={weight} onChange={(e) => setWeight(e.target.value)} />
                  </div>
                  <Button size="sm" disabled={updateProgress.isPending} onClick={handleSaveDaily}>
                    {updateProgress.isPending ? 'Saving…' : 'Save tracking'}
                  </Button>
                </div>

                {current.dietPlan.mealTypes.length > 0 ? (
                  <div className="space-y-1.5">
                    {current.dietPlan.mealTypes.map((mealType) => {
                      const status = todayLog?.mealsStatus[mealType] ?? 'PENDING';
                      return (
                        <div key={mealType} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-2 text-sm">
                          <span>{MEAL_LABELS[mealType]}</span>
                          <span className="flex items-center gap-1">
                            <DietProgressBadge status={status} />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs hover:bg-success/10 hover:text-success"
                              disabled={status === 'COMPLETED' || updateProgress.isPending}
                              onClick={() => handleMealStatus(mealType, 'COMPLETED')}
                            >
                              Done
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs hover:bg-warning/15 hover:text-warning-foreground"
                              disabled={status === 'SKIPPED' || updateProgress.isPending}
                              onClick={() => handleMealStatus(mealType, 'SKIPPED')}
                            >
                              Skip
                            </Button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">This plan has no meals configured yet.</p>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No active diet plan.</p>
        )}

        {canAssign && !current ? (
          <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-muted/20 p-3.5">
            <div className="min-w-48 space-y-1">
              <Label htmlFor="assignDietPlan" className="text-xs">
                Plan
              </Label>
              <DietPlanSelect id="assignDietPlan" value={planId} onChange={setPlanId} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dietStartDate" className="text-xs">
                Start date
              </Label>
              <Input id="dietStartDate" type="date" className="h-10" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <Button size="sm" disabled={!planId || assign.isPending} onClick={handleAssign}>
              {assign.isPending ? 'Assigning…' : 'Assign plan'}
            </Button>
          </div>
        ) : null}

        {history.length > 1 ? (
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-muted-foreground transition-colors hover:text-foreground">
              Plan history ({history.length})
            </summary>
            <div className="mt-2 space-y-1.5">
              {history.map((h) => (
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 px-2.5 py-2">
                  <span>{h.dietPlan.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {new Date(h.startDate).toLocaleDateString()} – {h.endDate ? new Date(h.endDate).toLocaleDateString() : 'now'}
                    <DietAssignmentStatusBadge status={h.status} />
                  </span>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
