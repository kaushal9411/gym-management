'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toIamError, useCreateRole, useUpdateRole } from '../hooks/use-iam';
import type { RoleDto } from '../types';
import { PermissionTree } from './permission-tree';

/** Create + edit form for CUSTOM roles (system roles never reach this form). */
export function RoleForm({ existing }: { existing?: RoleDto }) {
  const router = useRouter();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const isPending = createRole.isPending || updateRole.isPending;

  const [name, setName] = React.useState(existing?.name ?? '');
  const [description, setDescription] = React.useState(existing?.description ?? '');
  const [priority, setPriority] = React.useState(existing?.priority ?? 0);
  const [isDefault, setIsDefault] = React.useState(existing?.isDefault ?? false);
  const [isActive, setIsActive] = React.useState(existing?.isActive ?? true);
  const [permissions, setPermissions] = React.useState(new Set(existing?.permissions ?? []));
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const callbacks = {
      onSuccess: (role: RoleDto) => {
        toast.success(existing ? 'Role updated' : 'Role created');
        router.push(existing ? '/roles' : `/roles/${role.id}`);
      },
      onError: (err: unknown) => setError(toIamError(err).message),
    };
    if (existing) {
      updateRole.mutate(
        {
          roleId: existing.id,
          payload: { name, description: description || undefined, priority, isDefault, isActive, permissions: [...permissions] },
        },
        callbacks,
      );
    } else {
      createRole.mutate(
        { name, description: description || undefined, priority, isDefault, permissions: [...permissions] },
        callbacks,
      );
    }
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/roles">
          <ArrowLeft className="size-4" /> Back to roles
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{existing ? `Edit "${existing.name}"` : 'Create a custom role'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="role-name">Name</Label>
                <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} disabled={isPending} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="role-description">Description</Label>
                <Input
                  id="role-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this role for?"
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="space-y-2">
                <Label htmlFor="role-priority">Priority</Label>
                <Input
                  id="role-priority"
                  type="number"
                  min={0}
                  max={1000}
                  className="w-24"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  disabled={isPending}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox id="role-default" checked={isDefault} onCheckedChange={(c) => setIsDefault(c === true)} disabled={isPending} />
                <Label htmlFor="role-default" className="cursor-pointer font-normal">Default role for new users</Label>
              </div>
              {existing ? (
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox id="role-active" checked={isActive} onCheckedChange={(c) => setIsActive(c === true)} disabled={isPending} />
                  <Label htmlFor="role-active" className="cursor-pointer font-normal">Active (assignable)</Label>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Permissions ({permissions.size} selected)</Label>
              <PermissionTree selected={permissions} onChange={setPermissions} disabled={isPending} />
            </div>

            <Button type="submit" disabled={isPending || name.trim().length < 2}>
              {isPending ? 'Saving…' : existing ? 'Save role' : 'Create role'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
