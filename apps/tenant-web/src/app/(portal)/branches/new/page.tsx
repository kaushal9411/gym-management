'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BranchFormFields, DEFAULT_BRANCH_FORM_STATE, type BranchFormState } from '@/features/branch/components/branch-form-fields';
import { toBranchError, useCreateBranch } from '@/features/branch/hooks/use-branches';

function toNumberOrUndefined(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

export default function NewBranchPage() {
  const router = useRouter();
  const createBranch = useCreateBranch();
  const [form, setForm] = React.useState<BranchFormState>(DEFAULT_BRANCH_FORM_STATE);
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError('Branch name is required.');
      return;
    }
    createBranch.mutate(
      {
        name: form.name,
        branchCode: form.branchCode || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        whatsappNumber: form.whatsappNumber || undefined,
        addressLine1: form.addressLine1 || undefined,
        addressLine2: form.addressLine2 || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        country: form.country || undefined,
        postalCode: form.postalCode || undefined,
        latitude: toNumberOrUndefined(form.latitude),
        longitude: toNumberOrUndefined(form.longitude),
        timezone: form.timezone || undefined,
        operatingHours: Object.keys(form.operatingHours).length > 0 ? form.operatingHours : undefined,
        holidays: form.holidays.length > 0 ? form.holidays : undefined,
        capacity: toNumberOrUndefined(form.capacity),
        maxMembers: toNumberOrUndefined(form.maxMembers),
        maxStaff: toNumberOrUndefined(form.maxStaff),
        allowCheckIn: form.allowCheckIn,
        notes: form.notes || undefined,
      },
      {
        onSuccess: (branch) => {
          toast.success(`${branch.name} created`);
          router.push(`/branches/${branch.id}`);
        },
        onError: (err) => setError(toBranchError(err).message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/branches">
          <ArrowLeft className="size-4" /> Back to branches
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create a branch</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <BranchFormFields value={form} onChange={setForm} disabled={createBranch.isPending} />
            <LoadingButton type="submit" className="w-full" loading={createBranch.isPending} loadingText="Creating…">
              Create branch
            </LoadingButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
