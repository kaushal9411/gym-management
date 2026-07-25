'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DEFAULT_WORKOUT_PLAN_FORM_STATE,
  WorkoutPlanFormFields,
  type WorkoutPlanFormState,
} from '@/features/workouts/components/workout-plan-form-fields';
import { toWorkoutError, useCreateWorkoutPlan } from '@/features/workouts/hooks/use-workouts';

export default function NewWorkoutPlanPage() {
  const router = useRouter();
  const createPlan = useCreateWorkoutPlan();
  const [form, setForm] = React.useState<WorkoutPlanFormState>(DEFAULT_WORKOUT_PLAN_FORM_STATE);
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.durationWeeks) {
      setError('Name and duration are required.');
      return;
    }
    createPlan.mutate(
      {
        name: form.name,
        description: form.description || undefined,
        goal: form.goal || undefined,
        level: form.level,
        durationWeeks: Number(form.durationWeeks),
        trainerId: form.trainerId || undefined,
        isActive: form.isActive,
        notes: form.notes || undefined,
      },
      {
        onSuccess: (plan) => {
          toast.success(`${plan.name} created`);
          router.push(`/workout-plans/${plan.id}`);
        },
        onError: (err) => setError(toWorkoutError(err).message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/workout-plans">
          <ArrowLeft className="size-4" /> Back to workout plans
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create a workout plan</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <WorkoutPlanFormFields value={form} onChange={setForm} disabled={createPlan.isPending} />
            <Button type="submit" className="w-full" disabled={createPlan.isPending}>
              {createPlan.isPending ? 'Creating…' : 'Create plan'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
