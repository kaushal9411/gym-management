'use client';

import { Check, Dumbbell, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useMarkWorkoutProgress, useMemberWorkout } from '@/features/member-portal/hooks/use-member-portal';

export default function MemberWorkoutPage() {
  const { data: workout, isLoading } = useMemberWorkout();
  const markProgress = useMarkWorkoutProgress();

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!workout) return <EmptyState icon={Dumbbell} title="No workout plan assigned" description="Ask a trainer to assign you one." />;

  const progressByExercise = new Map(workout.progress.map((p) => [p.exerciseId, p]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{workout.workoutPlan.name}</h1>
        <p className="text-sm text-muted-foreground">
          {workout.workoutPlan.level} · {workout.workoutPlan.durationWeeks} weeks
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exercises</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {workout.workoutPlan.exercises.map((ex) => {
            const progress = progressByExercise.get(ex.exerciseId);
            return (
              <div key={ex.exerciseId} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{ex.name}</p>
                  <p className="text-xs text-muted-foreground">{ex.dayOfWeek}</p>
                </div>
                <div className="flex items-center gap-2">
                  {progress?.status === 'COMPLETED' ? (
                    <Badge variant="success">Completed</Badge>
                  ) : progress?.status === 'SKIPPED' ? (
                    <Badge variant="secondary">Skipped</Badge>
                  ) : (
                    <>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8 text-success"
                        aria-label={`Mark ${ex.name} completed`}
                        disabled={markProgress.isPending}
                        onClick={() => markProgress.mutate({ assignmentId: workout.id, exerciseId: ex.exerciseId, status: 'COMPLETED' })}
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8 text-muted-foreground"
                        aria-label={`Mark ${ex.name} skipped`}
                        disabled={markProgress.isPending}
                        onClick={() => markProgress.mutate({ assignmentId: workout.id, exerciseId: ex.exerciseId, status: 'SKIPPED' })}
                      >
                        <X className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
