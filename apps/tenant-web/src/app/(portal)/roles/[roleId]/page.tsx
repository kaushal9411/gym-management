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
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (role.isError || !role.data || role.data.isSystem) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">
          {role.data?.isSystem ? 'System roles are immutable — clone the role instead.' : 'Role not found.'}
        </p>
        <Button variant="outline" asChild>
          <Link href="/roles">Back to roles</Link>
        </Button>
      </div>
    );
  }
  return <RoleForm existing={role.data} />;
}
