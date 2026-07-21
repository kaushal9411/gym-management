'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { BranchAccessEditor, type BranchAssignment } from '@/features/iam/components/branch-access-editor';
import { PermissionTree } from '@/features/iam/components/permission-tree';
import { RoleMultiSelect } from '@/features/iam/components/role-select';
import { UserStatusBadge } from '@/features/iam/components/status-badge';
import {
  toIamError,
  useSetUserBranches,
  useSetUserPermissionOverrides,
  useSetUserRoles,
  useUpdateUser,
  useUser,
  useUserStatusAction,
} from '@/features/iam/hooks/use-iam';

export default function UserDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const user = useUser(userId);
  const { hasPermission } = usePermissions();
  const me = useCurrentUser();
  const canManage = hasPermission('users:manage');
  const isSelf = me?.id === userId;

  if (user.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (user.isError || !user.data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">User not found.</p>
        <Button variant="outline" asChild>
          <Link href="/users">Back to users</Link>
        </Button>
      </div>
    );
  }

  const u = user.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/users">
            <ArrowLeft className="size-4" /> Back to users
          </Link>
        </Button>
        <StatusActions userId={u.id} status={u.status} deleted={!!u.deletedAt} disabled={!canManage || isSelf} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-6">
          <Avatar className="size-16">
            {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-lg">
              {u.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{u.name}</h1>
              <UserStatusBadge status={u.status} deleted={!!u.deletedAt} />
            </div>
            <p className="text-sm text-muted-foreground">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
            <p className="text-xs text-muted-foreground">
              Joined {new Date(u.createdAt).toLocaleDateString()} · Last login{' '}
              {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'never'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {u.roles.map((r) => (
              <Badge key={r.id} variant={r.isSystem ? 'secondary' : 'outline'}>{r.name}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {canManage ? <ProfileEditor userId={u.id} initial={u} /> : null}
      {canManage ? <RolesEditor userId={u.id} initialRoleIds={u.roles.map((r) => r.id)} disabled={isSelf} /> : null}
      {canManage ? (
        <BranchesEditor
          userId={u.id}
          initial={{ allBranches: u.allBranches, branches: u.branches.map((b) => ({ branchId: b.branchId, isPrimary: b.isPrimary })) }}
        />
      ) : null}
      {canManage ? (
        <OverridesEditor
          userId={u.id}
          initialGrants={u.permissionOverrides.filter((o) => o.mode === 'GRANT').map((o) => o.key)}
          initialDenies={u.permissionOverrides.filter((o) => o.mode === 'DENY').map((o) => o.key)}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" /> Effective permissions ({u.effectivePermissions.length})
          </CardTitle>
          <CardDescription>Roles + grants − denies. This is exactly what the API enforces.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {u.effectivePermissions.map((key) => (
            <Badge key={key} variant="outline" className="font-mono text-xs font-normal">{key}</Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusActions({
  userId,
  status,
  deleted,
  disabled,
}: {
  userId: string;
  status: string;
  deleted: boolean;
  disabled: boolean;
}) {
  const statusAction = useUserStatusAction();
  const run = (action: 'suspend' | 'deactivate' | 'restore' | 'delete') =>
    statusAction.mutate(
      { userId, action },
      {
        onSuccess: () => toast.success('Done'),
        onError: (err) => toast.error(toIamError(err).message),
      },
    );

  if (deleted || status === 'SUSPENDED' || status === 'DEACTIVATED') {
    return (
      <Button variant="outline" size="sm" disabled={disabled || statusAction.isPending} onClick={() => run('restore')}>
        Restore
      </Button>
    );
  }
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={disabled || statusAction.isPending} onClick={() => run('suspend')}>
        Suspend
      </Button>
      <Button variant="outline" size="sm" disabled={disabled || statusAction.isPending} onClick={() => run('deactivate')}>
        Deactivate
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive"
        disabled={disabled || statusAction.isPending}
        onClick={() => run('delete')}
      >
        Delete
      </Button>
    </div>
  );
}

function ProfileEditor({
  userId,
  initial,
}: {
  userId: string;
  initial: { name: string; email: string; phone: string | null };
}) {
  const updateUser = useUpdateUser();
  const [name, setName] = React.useState(initial.name);
  const [email, setEmail] = React.useState(initial.email);
  const [phone, setPhone] = React.useState(initial.phone ?? '');

  const save = () =>
    updateUser.mutate(
      { userId, payload: { name, email, phone: phone || undefined } },
      {
        onSuccess: () => toast.success('Profile saved'),
        onError: (err) => toast.error(toIamError(err).message),
      },
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Account details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input id="edit-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <Button size="sm" onClick={save} disabled={updateUser.isPending}>
          {updateUser.isPending ? 'Saving…' : 'Save details'}
        </Button>
      </CardContent>
    </Card>
  );
}

function RolesEditor({ userId, initialRoleIds, disabled }: { userId: string; initialRoleIds: string[]; disabled: boolean }) {
  const setRoles = useSetUserRoles();
  const [roleIds, setRoleIds] = React.useState(initialRoleIds);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Roles</CardTitle>
        {disabled ? <CardDescription>You can&apos;t change your own roles.</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <RoleMultiSelect selected={roleIds} onChange={setRoleIds} disabled={disabled || setRoles.isPending} />
        <Button
          size="sm"
          disabled={disabled || setRoles.isPending || roleIds.length === 0}
          onClick={() =>
            setRoles.mutate(
              { userId, roleIds },
              {
                onSuccess: () => toast.success('Roles updated'),
                onError: (err) => toast.error(toIamError(err).message),
              },
            )
          }
        >
          {setRoles.isPending ? 'Saving…' : 'Save roles'}
        </Button>
      </CardContent>
    </Card>
  );
}

function BranchesEditor({
  userId,
  initial,
}: {
  userId: string;
  initial: { allBranches: boolean; branches: BranchAssignment[] };
}) {
  const setBranches = useSetUserBranches();
  const [access, setAccess] = React.useState(initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Branch access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <BranchAccessEditor
          allBranches={access.allBranches}
          branches={access.branches}
          onChange={setAccess}
          disabled={setBranches.isPending}
        />
        <Button
          size="sm"
          disabled={setBranches.isPending}
          onClick={() =>
            setBranches.mutate(
              { userId, allBranches: access.allBranches, branches: access.branches },
              {
                onSuccess: () => toast.success('Branch access updated'),
                onError: (err) => toast.error(toIamError(err).message),
              },
            )
          }
        >
          {setBranches.isPending ? 'Saving…' : 'Save branch access'}
        </Button>
      </CardContent>
    </Card>
  );
}

function OverridesEditor({
  userId,
  initialGrants,
  initialDenies,
}: {
  userId: string;
  initialGrants: string[];
  initialDenies: string[];
}) {
  const setOverrides = useSetUserPermissionOverrides();
  const [grants, setGrants] = React.useState(new Set(initialGrants));
  const [denies, setDenies] = React.useState(new Set(initialDenies));
  const [tab, setTab] = React.useState<'GRANT' | 'DENY'>('GRANT');

  const save = () =>
    setOverrides.mutate(
      {
        userId,
        overrides: [
          ...[...grants].map((key) => ({ key, mode: 'GRANT' as const })),
          ...[...denies].map((key) => ({ key, mode: 'DENY' as const })),
        ],
      },
      {
        onSuccess: () => toast.success('Overrides updated'),
        onError: (err) => toast.error(toIamError(err).message),
      },
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Permission overrides</CardTitle>
        <CardDescription>
          Fine-tune this ONE user beyond their roles. Grants add extra permissions; denies remove them — a deny always
          wins.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="inline-flex rounded-md border p-0.5">
          {(['GRANT', 'DENY'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTab(mode)}
              className={
                tab === mode
                  ? 'rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                  : 'rounded px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent'
              }
            >
              {mode === 'GRANT' ? `Grants (${grants.size})` : `Denies (${denies.size})`}
            </button>
          ))}
        </div>
        {tab === 'GRANT' ? (
          <PermissionTree selected={grants} onChange={setGrants} disabled={setOverrides.isPending} />
        ) : (
          <PermissionTree selected={denies} onChange={setDenies} disabled={setOverrides.isPending} />
        )}
        <Button size="sm" onClick={save} disabled={setOverrides.isPending}>
          {setOverrides.isPending ? 'Saving…' : 'Save overrides'}
        </Button>
      </CardContent>
    </Card>
  );
}
