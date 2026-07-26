'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DEFAULT_DIET_PLAN_FORM_STATE,
  DietPlanFormFields,
  type DietPlanFormState,
} from '@/features/diet/components/diet-plan-form-fields';
import { toDietError, useCreateDietPlan } from '@/features/diet/hooks/use-diet';

export default function NewDietPlanPage() {
  const router = useRouter();
  const createPlan = useCreateDietPlan();
  const [form, setForm] = React.useState<DietPlanFormState>(DEFAULT_DIET_PLAN_FORM_STATE);
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.durationDays) {
      setError('Name and duration are required.');
      return;
    }
    createPlan.mutate(
      {
        name: form.name,
        description: form.description || undefined,
        goal: form.goal || undefined,
        dailyCalories: form.dailyCalories ? Number(form.dailyCalories) : undefined,
        durationDays: Number(form.durationDays),
        trainerId: form.trainerId || undefined,
        isActive: form.isActive,
        notes: form.notes || undefined,
      },
      {
        onSuccess: (plan) => {
          toast.success(`${plan.name} created`);
          router.push(`/diet-plans/${plan.id}`);
        },
        onError: (err) => setError(toDietError(err).message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/diet-plans">
          <ArrowLeft className="size-4" /> Back to diet plans
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create a diet plan</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <DietPlanFormFields value={form} onChange={setForm} disabled={createPlan.isPending} />
            <LoadingButton type="submit" className="w-full" loading={createPlan.isPending} loadingText="Creating…">
              Create plan
            </LoadingButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
