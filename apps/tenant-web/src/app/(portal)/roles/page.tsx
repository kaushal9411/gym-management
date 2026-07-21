'use client';

import * as React from 'react';
import Link from 'next/link';
import { Copy, Plus, Shield, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { IamNav } from '@/features/iam/components/iam-nav';
import { toIamError, useCloneRole, useDeleteRole, useRoles } from '@/features/iam/hooks/use-iam';
import type { RoleDto } from '@/features/iam/types';

export default function RolesPage() {
  const roles = useRoles();
  const cloneRole = useCloneRole();
  const deleteRole = useDeleteRole();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('roles:manage-custom');

  const columns: DataTableColumn<RoleDto>[] = [
    {
      key: 'name',
      header: 'Role',
      render: (r) => (
        <span className="flex items-center gap-2">
          <Shield className="size-4 text-muted-foreground" />
          {canManage && !r.isSystem ? (
            <Link href={`/roles/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
          ) : (
            <span className="font-medium">{r.name}</span>
          )}
          {r.isSystem ? <Badge variant="secondary">System</Badge> : <Badge variant="outline">Custom</Badge>}
          {r.isDefault ? <Badge>Default</Badge> : null}
          {!r.isActive ? <Badge variant="destructive">Inactive</Badge> : null}
        </span>
      ),
    },
    { key: 'description', header: 'Description', render: (r) => r.description ?? '—' },
    { key: 'priority', header: 'Priority', render: (r) => r.priority },
    { key: 'permissions', header: 'Permissions', render: (r) => r.permissions.length },
    { key: 'users', header: 'Users', render: (r) => r.userCount },
    {
      key: 'actions',
      header: '',
      render: (r) =>
        canManage ? (
          <span className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Clone ${r.name}`}
              disabled={cloneRole.isPending}
              onClick={() =>
                cloneRole.mutate(
                  { roleId: r.id },
                  {
                    onSuccess: (created) => toast.success(`Cloned as "${created.name}"`),
                    onError: (err) => toast.error(toIamError(err).message),
                  },
                )
              }
            >
              <Copy className="size-4" />
            </Button>
            {!r.isSystem ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive"
                aria-label={`Delete ${r.name}`}
                disabled={deleteRole.isPending}
                onClick={() =>
                  deleteRole.mutate(r.id, {
                    onSuccess: () => toast.success('Role deleted'),
                    onError: (err) => toast.error(toIamError(err).message),
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </span>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles</h1>
          <p className="text-muted-foreground">System roles are shared and immutable — clone one to customize it.</p>
        </div>
        {canManage ? (
          <Button size="sm" asChild>
            <Link href="/roles/new">
              <Plus className="size-4" /> New role
            </Link>
          </Button>
        ) : null}
      </div>

      <IamNav />

      <DataTable
        columns={columns}
        rows={roles.data ?? []}
        rowKey={(r) => r.id}
        loading={roles.isPending}
        emptyMessage="No roles yet."
      />
    </div>
  );
}
