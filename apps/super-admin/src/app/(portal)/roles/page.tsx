'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { Pagination } from '@/components/pagination';
import {
  toRoleError,
  useAdmins,
  useCreateAdmin,
  useCreateRole,
  usePermissionCatalog,
  useRoles,
  useSetAdminStatus,
  useUpdateAdminRole,
} from '@/features/roles/hooks/use-roles';
import type { AdminRole, AdminUserListItem } from '@/features/roles/types';

function RolesTab() {
  const { data: roles, isLoading } = useRoles();
  const { data: permissions } = usePermissionCatalog();
  const createRole = useCreateRole();

  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set());

  const togglePermission = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const submit = () => {
    createRole.mutate(
      { name, description: description || undefined, permissionKeys: Array.from(selectedKeys) },
      {
        onSuccess: () => {
          toast.success('Custom role created');
          setCreating(false);
          setName('');
          setDescription('');
          setSelectedKeys(new Set());
        },
        onError: (err) => toast.error(toRoleError(err).message),
      },
    );
  };

  if (isLoading || !roles) return <Skeleton className="h-64 rounded-xl" />;

  const columns: DataTableColumn<AdminRole>[] = [
    { key: 'name', header: 'Role', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'type', header: 'Type', render: (r) => (r.isSystem ? 'System' : 'Custom') },
    { key: 'permissions', header: 'Permissions', render: (r) => r.rolePermissions.length },
    { key: 'admins', header: 'Admins', render: (r) => r._count?.adminUsers ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setCreating(true)}>Create custom role</Button></div>
      <DataTable columns={columns} rows={roles} rowKey={(r) => r.id} />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>Create custom role</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="REGIONAL_MANAGER" /></div>
            <div className="space-y-1"><Label>Description (optional)</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Permissions</Label>
              <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
                {(permissions ?? []).map((p) => (
                  <label key={p.key} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={selectedKeys.has(p.key)} onChange={() => togglePermission(p.key)} />
                    {p.key}
                  </label>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={submit} disabled={createRole.isPending || !name}>Create role</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminsTab() {
  const { data: roles } = useRoles();
  const [page, setPage] = React.useState(1);
  const { data: admins, isLoading } = useAdmins({ page, limit: 20 });
  const createAdmin = useCreateAdmin();
  const updateRole = useUpdateAdminRole();
  const setStatus = useSetAdminStatus();

  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [roleId, setRoleId] = React.useState('');
  const [createdCredentials, setCreatedCredentials] = React.useState<{ email: string; temporaryPassword: string } | null>(null);

  const submit = () => {
    createAdmin.mutate(
      { name, email, roleId },
      {
        onSuccess: (result) => {
          toast.success('Admin created');
          setCreatedCredentials({ email: result.email, temporaryPassword: result.temporaryPassword });
          setCreating(false);
          setName('');
          setEmail('');
        },
        onError: (err) => toast.error(toRoleError(err).message),
      },
    );
  };

  if (isLoading || !admins) return <Skeleton className="h-64 rounded-xl" />;

  const columns: DataTableColumn<AdminUserListItem>[] = [
    { key: 'name', header: 'Name', render: (a) => a.name },
    { key: 'email', header: 'Email', render: (a) => a.email },
    {
      key: 'role',
      header: 'Role',
      render: (a) => (
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={roles?.find((r) => r.name === a.role)?.id ?? ''}
          onChange={(e) => updateRole.mutate({ adminId: a.id, roleId: e.target.value }, { onError: (err) => toast.error(toRoleError(err).message) })}
        >
          {(roles ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (a) => (
        <button
          onClick={() => setStatus.mutate({ adminId: a.id, status: a.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.status === 'ACTIVE' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}
        >
          {a.status}
        </button>
      ),
    },
    { key: 'lastLoginAt', header: 'Last login', render: (a) => (a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : 'Never') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setCreating(true)}>Create admin</Button></div>
      <DataTable columns={columns} rows={admins.items} rowKey={(a) => a.id} />
      <Pagination page={admins.page} totalPages={admins.totalPages} onPageChange={setPage} />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create admin account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Role</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">Select a role…</option>
                {(roles ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <Button className="w-full" onClick={submit} disabled={createAdmin.isPending || !name || !email || !roleId}>Create admin</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdCredentials} onOpenChange={(open) => !open && setCreatedCredentials(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Admin created</DialogTitle></DialogHeader>
          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              <p>Share these credentials securely — they are shown only once.</p>
              <p><span className="text-muted-foreground">Email:</span> {createdCredentials?.email}</p>
              <p className="font-mono"><span className="text-muted-foreground">Temporary password:</span> {createdCredentials?.temporaryPassword}</p>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RolesPage() {
  const [tab, setTab] = React.useState<'roles' | 'admins'>('roles');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roles & Admins</h1>
        <p className="text-muted-foreground">System + custom roles, permissions, and admin staff accounts.</p>
      </div>

      <div className="flex gap-1 border-b">
        {(['roles', 'admins'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'roles' ? <RolesTab /> : <AdminsTab />}
    </div>
  );
}
