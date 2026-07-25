'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { ExerciseProgressBadge } from './workout-badges';
import { WorkoutPlanSelect } from './workout-plan-select';
import {
  toWorkoutError,
  useAssignWorkoutPlan,
  useMarkWorkoutProgress,
  useMemberWorkoutPlans,
  useRemoveWorkoutAssignment,
} from '../hooks/use-workouts';
import type { ExerciseProgressStatus } from '../types';

interface MemberWorkoutCardProps {
  memberId: string;
}

export function MemberWorkoutCard({ memberId }: MemberWorkoutCardProps) {
  const { hasPermission } = usePermissions();
  const canAssign = hasPermission('workouts:assign');
  const canProgress = hasPermission('workouts:progress');

  const data = useMemberWorkoutPlans(memberId);
  const assign = useAssignWorkoutPlan();
  const remove = useRemoveWorkoutAssignment();
  const markProgress = useMarkWorkoutProgress();

  const [planId, setPlanId] = React.useState('');
  const [startDate, setStartDate] = React.useState(() => new Date().toISOString().slice(0, 10));

  const current = data.data?.current ?? null;
  const history = data.data?.history ?? [];

  const handleAssign = () => {
    if (!planId) return;
    assign.mutate(
      { planId, payload: { memberId, startDate } },
      {
        onSuccess: () => {
          toast.success('Workout plan assigned.');
          setPlanId('');
        },
        onError: (err) => toast.error(toWorkoutError(err).message),
      },
    );
  };

  const handleRemove = () => {
    if (!current) return;
    remove.mutate(current.id, {
      onSuccess: () => toast.success('Workout plan removed.'),
      onError: (err) => toast.error(toWorkoutError(err).message),
    });
  };

  const handleMark = (exerciseId: string, status: ExerciseProgressStatus) => {
    if (!current) return;
    markProgress.mutate(
      { assignmentId: current.id, payload: { exerciseId, status } },
      { onError: (err) => toast.error(toWorkoutError(err).message) },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workout</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : current ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                On{' '}
                <Link href={`/workout-plans/${current.workoutPlan.id}`} className="font-medium hover:underline">
                  {current.workoutPlan.name}
                </Link>{' '}
                — {current.workoutPlan.durationWeeks}w, {current.workoutPlan.level}
              </p>
              {canAssign ? (
                <Button size="sm" variant="outline" disabled={remove.isPending} onClick={handleRemove}>
                  {remove.isPending ? 'Removing…' : 'Remove'}
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Started {new Date(current.startDate).toLocaleDateString()}
              {current.endDate ? ` – ${new Date(current.endDate).toLocaleDateString()}` : ''} · {current.progressPercent}% complete (
              {current.completedCount}/{current.totalExercises})
            </p>
            {current.progress.length > 0 ? (
              <div className="space-y-1.5">
                {current.progress.map((p) => (
                  <div key={p.exerciseId} className="flex flex-wrap items-center justify-between gap-2 border-b pb-1.5 text-sm last:border-0 last:pb-0">
                    <span>
                      {p.exerciseName} <span className="text-xs text-muted-foreground">({p.dayOfWeek[0]}{p.dayOfWeek.slice(1).toLowerCase()})</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <ExerciseProgressBadge status={p.status} />
                      {canProgress ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={p.status === 'COMPLETED' || markProgress.isPending}
                            onClick={() => handleMark(p.exerciseId, 'COMPLETED')}
                          >
                            Done
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={p.status === 'SKIPPED' || markProgress.isPending}
                            onClick={() => handleMark(p.exerciseId, 'SKIPPED')}
                          >
                            Skip
                          </Button>
                        </>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">This plan has no exercises scheduled yet.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No active workout plan.</p>
        )}

        {canAssign && !current ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 space-y-1">
              <Label htmlFor="assignWorkoutPlan" className="text-xs">
                Plan
              </Label>
              <WorkoutPlanSelect id="assignWorkoutPlan" value={planId} onChange={setPlanId} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="workoutStartDate" className="text-xs">
                Start date
              </Label>
              <Input id="workoutStartDate" type="date" className="h-10" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <Button size="sm" disabled={!planId || assign.isPending} onClick={handleAssign}>
              {assign.isPending ? 'Assigning…' : 'Assign plan'}
            </Button>
          </div>
        ) : null}

        {history.length > 1 ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Plan history ({history.length})</summary>
            <div className="mt-2 space-y-1.5">
              {history.map((h) => (
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-1.5 last:border-0">
                  <span>{h.workoutPlan.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {new Date(h.startDate).toLocaleDateString()} – {h.endDate ? new Date(h.endDate).toLocaleDateString() : 'now'}
                    <Badge variant="secondary">{h.status}</Badge>
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
