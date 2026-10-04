'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RoleForm } from '@/features/iam/components/role-form';
import { useRole } from '@/features/iam/hooks/use-iam';

export default function EditRolePage() {
  const params = useParams<{ roleId: string }>();
  const role = useRole(params.roleId);

  if (role.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-36 w-full rounded-3xl" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }
  // System roles still render (read-only, with the immutability banner) so their permissions can be inspected.
  if (role.isError || !role.data) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-destructive">Role not found.</p>
        <Button variant="outline" asChild>
          <Link href="/roles">Back to roles</Link>
        </Button>
      </div>
    );
  }
  return <RoleForm existing={role.data} />;
}
