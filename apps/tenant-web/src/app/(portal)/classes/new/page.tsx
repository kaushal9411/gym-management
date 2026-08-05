'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingButton } from '@/components/ui/loading-button';
import {
  DEFAULT_GROUP_CLASS_FORM_STATE,
  GroupClassFormFields,
  type GroupClassFormState,
} from '@/features/classes/components/group-class-form-fields';
import { toClassError, useCreateClass } from '@/features/classes/hooks/use-classes';

export default function NewClassPage() {
  const router = useRouter();
  const createClass = useCreateClass();
  const [form, setForm] = React.useState<GroupClassFormState>(DEFAULT_GROUP_CLASS_FORM_STATE);
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.branchId || !form.capacity || !form.durationMinutes) {
      setError('Name, branch, capacity, and duration are required.');
      return;
    }
    createClass.mutate(
      {
        name: form.name,
        description: form.description || undefined,
        trainerId: form.trainerId || undefined,
        branchId: form.branchId,
        capacity: Number(form.capacity),
        durationMinutes: Number(form.durationMinutes),
        isActive: form.isActive,
      },
      {
        onSuccess: (created) => {
          toast.success(`${created.name} created`);
          router.push(`/classes/${created.id}`);
        },
        onError: (err) => setError(toClassError(err).message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/classes">
          <ArrowLeft className="size-4" /> Back to classes
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create a class</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <GroupClassFormFields value={form} onChange={setForm} disabled={createClass.isPending} />
            <p className="text-xs text-muted-foreground">
              You can set the weekly recurring schedule after creating the class.
            </p>
            <LoadingButton type="submit" className="w-full" loading={createClass.isPending} loadingText="Creating…">
              Create class
            </LoadingButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
