'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Clock, KeyRound, MapPin, ShieldCheck, ShieldOff, UserRound, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { BranchAccessCards } from '@/features/iam/components/branch-access-cards';
import type { BranchAssignment } from '@/features/iam/components/branch-access-editor';
import { HeroChip, HeroShell, KpiTiles, UnsavedChip } from '@/features/iam/components/iam-detail-ui';
import { type OverrideMode, PermissionOverridesTree } from '@/features/iam/components/permission-overrides-tree';
import { RolePicker } from '@/features/iam/components/role-picker';
import { UserStatusBadge } from '@/features/iam/components/status-badge';
import { displayRoleName, STATUS_LABEL } from '@/features/iam/components/users-overview';
import {
  toIamError,
  useRoles,
  useSetUserBranches,
  useSetUserPermissionOverrides,
  useSetUserRoles,
  useUpdateUser,
  useUser,
  useUserStatusAction,
} from '@/features/iam/hooks/use-iam';
import { PanelCard } from '@/features/members/components/detail/detail-ui';

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function sinceLabel(iso: string | null): string {
  if (!iso) return 'Never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export default function UserDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const user = useUser(userId);
  const { hasPermission } = usePermissions();
  const me = useCurrentUser();
  const reduce = useReducedMotion();
  const canManage = hasPermission('users:manage');
  const isSelf = me?.id === userId;

  if (user.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
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
  const branchChips = u.allBranches ? ['All branches'] : u.branches.map((b) => b.branchName);
  const shownBranches = branchChips.slice(0, 4);

  // Effective access summary: group the already-loaded effective keys by resource (the part before ':').
  const byResource = new Map<string, number>();
  for (const key of u.effectivePermissions) {
    const resource = key.split(':')[0] ?? key;
    byResource.set(resource, (byResource.get(resource) ?? 0) + 1);
  }
  const resourceRows = [...byResource.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const grants = u.permissionOverrides.filter((o) => o.mode === 'GRANT').length;
  const revokes = u.permissionOverrides.length - grants;

  const profileEditor = canManage ? <ProfileEditor userId={u.id} initial={u} /> : null;

  return (
    <div className="w-full space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/users">
          <ArrowLeft className="size-4" /> Back to users
        </Link>
      </Button>

      <HeroShell
        title={u.name}
        subtitle={`${u.email}${u.phone ? ` · ${u.phone}` : ''}`}
        leading={
          <div className="size-[76px] shrink-0 rounded-full p-[3px]" style={{ backgroundImage: 'conic-gradient(from 210deg, #fde68a, #f9a8d4, #a5b4fc, #6ee7b7, #fde68a)' }}>
            <Avatar className="size-full border-0">
              {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt="" /> : null}
              <AvatarFallback className="bg-indigo-950/85 text-2xl font-extrabold text-white">{initialsOf(u.name) || '?'}</AvatarFallback>
            </Avatar>
          </div>
        }
        actions={<StatusActions userId={u.id} status={u.status} deleted={!!u.deletedAt} disabled={!canManage || isSelf} />}
      >
        <span className="inline-flex items-center"><UserStatusBadge status={u.status} deleted={!!u.deletedAt} /></span>
        {u.roles.map((r) => (
          <HeroChip key={r.id} icon={ShieldCheck}>{displayRoleName(r.name)}</HeroChip>
        ))}
        {shownBranches.map((b) => (
          <HeroChip key={b} icon={MapPin}>{b}</HeroChip>
        ))}
        {branchChips.length > shownBranches.length ? <HeroChip>+{branchChips.length - shownBranches.length} more</HeroChip> : null}
        <HeroChip icon={Clock}>Last sign-in {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'never'}</HeroChip>
        <HeroChip>Created {new Date(u.createdAt).toLocaleDateString()}</HeroChip>
      </HeroShell>

      <KpiTiles
        label="Account figures"
        tiles={[
          { key: 'status', label: 'Status', icon: UserRound, accent: u.status === 'ACTIVE' && !u.deletedAt ? 'success' : 'warning', value: u.deletedAt ? 'Deleted' : STATUS_LABEL[u.status] },
          { key: 'roles', label: 'Roles', icon: ShieldCheck, accent: 'violet', value: u.roles.length },
          { key: 'branches', label: 'Branches', icon: MapPin, accent: 'warning', value: u.allBranches ? 'All' : u.branches.length },
          { key: 'mfa', label: 'Two-factor', icon: u.mfaEnabled ? ShieldCheck : ShieldOff, accent: u.mfaEnabled ? 'success' : 'destructive', value: u.mfaEnabled ? 'On' : 'Off' },
          { key: 'perms', label: 'Effective permissions', icon: KeyRound, accent: 'primary', value: u.effectivePermissions.length },
          { key: 'login', label: 'Last sign-in', icon: Clock, accent: 'aqua', value: sinceLabel(u.lastLoginAt) },
        ]}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          {profileEditor}
          {canManage ? <RolesEditor userId={u.id} initialRoleIds={u.roles.map((r) => r.id)} disabled={isSelf} /> : null}
          {canManage ? <OverridesEditor userId={u.id} initialOverrides={u.permissionOverrides} effective={u.effectivePermissions} /> : null}
        </div>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-3">
          {canManage ? (
            <BranchesEditor
              userId={u.id}
              initial={{ allBranches: u.allBranches, branches: u.branches.map((b) => ({ branchId: b.branchId, isPrimary: b.isPrimary })) }}
            />
          ) : null}

          <PanelCard icon={Users} accent="aqua" title="Effective access" delay={0.2} right={<span className="text-xs font-bold tabular-nums text-muted-foreground">{u.effectivePermissions.length} permissions</span>}>
            <p className="text-xs text-muted-foreground">Roles + grants − revokes. This is exactly what the API enforces.</p>
            {u.permissionOverrides.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 text-[11.5px] font-bold">
                <span className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: 'color-mix(in oklch, var(--success) 15%, transparent)', color: 'var(--success)' }}>{grants} grant{grants === 1 ? '' : 's'}</span>
                <span className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: 'color-mix(in oklch, var(--destructive) 15%, transparent)', color: 'var(--destructive)' }}>{revokes} revoke{revokes === 1 ? '' : 's'}</span>
              </div>
            ) : null}
            {resourceRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No permissions.</p>
            ) : (
              <ul className="space-y-1.5">
                {resourceRows.map(([resource, n], i) => (
                  <motion.li key={resource} initial={reduce ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }} className="flex items-center justify-between gap-3 text-[12.5px]">
                    <span className="truncate font-semibold capitalize">{resource.replace(/-/g, ' ')}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">{n}</span>
                  </motion.li>
                ))}
              </ul>
            )}
          </PanelCard>
        </div>
      </div>
    </div>
  );
}

function StatusActions({ userId, status, deleted, disabled }: { userId: string; status: string; deleted: boolean; disabled: boolean }) {
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
      <Button variant="success" size="sm" data-solid disabled={disabled || statusAction.isPending} onClick={() => run('restore')}>
        Restore
      </Button>
    );
  }
  return (
    <>
      <Button variant="warning" size="sm" data-solid disabled={disabled || statusAction.isPending} onClick={() => run('suspend')}>
        Suspend
      </Button>
      <Button variant="outline" size="sm" disabled={disabled || statusAction.isPending} onClick={() => run('deactivate')}>
        Deactivate
      </Button>
      <Button variant="outline" size="sm" className="!border-red-300/60 !text-red-100 hover:!bg-red-500/40" disabled={disabled || statusAction.isPending} onClick={() => run('delete')}>
        Delete
      </Button>
    </>
  );
}

function ProfileEditor({ userId, initial }: { userId: string; initial: { name: string; email: string; phone: string | null } }) {
  const updateUser = useUpdateUser();
  const [name, setName] = React.useState(initial.name);
  const [email, setEmail] = React.useState(initial.email);
  const [phone, setPhone] = React.useState(initial.phone ?? '');
  const dirty = name !== initial.name || email !== initial.email || phone !== (initial.phone ?? '');

  const save = () =>
    updateUser.mutate(
      { userId, payload: { name, email, phone: phone || undefined } },
      {
        onSuccess: () => toast.success('Profile saved'),
        onError: (err) => toast.error(toIamError(err).message),
      },
    );

  return (
    <PanelCard icon={UserRound} accent="primary" title="Account details" delay={0} right={dirty ? <UnsavedChip /> : undefined}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="edit-name" required>Name</Label>
          <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-email" required>Email</Label>
          <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-phone">Phone</Label>
          <Input id="edit-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <LoadingButton size="sm" onClick={save} loading={updateUser.isPending} loadingText="Saving…">
        Save details
      </LoadingButton>
    </PanelCard>
  );
}

function RolesEditor({ userId, initialRoleIds, disabled }: { userId: string; initialRoleIds: string[]; disabled: boolean }) {
  const setRoles = useSetUserRoles();
  const roles = useRoles();
  const [roleIds, setRoleIds] = React.useState(initialRoleIds);
  const dirty = !sameIds(roleIds, initialRoleIds);

  return (
    <PanelCard icon={ShieldCheck} accent="violet" title="Roles" delay={0.05} right={dirty ? <UnsavedChip /> : undefined}>
      {disabled ? <p className="text-sm text-muted-foreground">You can&apos;t change your own roles.</p> : null}
      <RolePicker
        label="Roles"
        mode="multi"
        roles={roles.data}
        loading={roles.isPending}
        // SUPER_ADMIN is platform-plane and never offered; inactive roles are hidden.
        filter={(r) => r.name !== 'SUPER_ADMIN' && r.isActive}
        selected={roleIds}
        onChange={setRoleIds}
        disabled={disabled || setRoles.isPending}
      />
      <LoadingButton
        size="sm"
        loading={setRoles.isPending}
        loadingText="Saving…"
        disabled={disabled || roleIds.length === 0}
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
        Save roles
      </LoadingButton>
    </PanelCard>
  );
}

function BranchesEditor({ userId, initial }: { userId: string; initial: { allBranches: boolean; branches: BranchAssignment[] } }) {
  const setBranches = useSetUserBranches();
  const [access, setAccess] = React.useState(initial);
  const dirty =
    access.allBranches !== initial.allBranches ||
    access.branches.length !== initial.branches.length ||
    access.branches.some((b) => {
      const o = initial.branches.find((x) => x.branchId === b.branchId);
      return !o || !!o.isPrimary !== !!b.isPrimary;
    });

  return (
    <PanelCard icon={MapPin} accent="warning" title="Branch access" delay={0.1} right={dirty ? <UnsavedChip /> : undefined}>
      <BranchAccessCards allBranches={access.allBranches} branches={access.branches} onChange={setAccess} disabled={setBranches.isPending} />
      <LoadingButton
        size="sm"
        loading={setBranches.isPending}
        loadingText="Saving…"
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
        Save branch access
      </LoadingButton>
    </PanelCard>
  );
}

function OverridesEditor({
  userId,
  initialOverrides,
  effective,
}: {
  userId: string;
  initialOverrides: Array<{ key: string; mode: 'GRANT' | 'DENY' }>;
  effective: string[];
}) {
  const setOverrides = useSetUserPermissionOverrides();
  const [overrides, setOverrides_] = React.useState(() => new Map(initialOverrides.map((o) => [o.key, o.mode])));
  const effectiveSet = React.useMemo(() => new Set(effective), [effective]);

  const grants = [...overrides.values()].filter((m) => m === 'GRANT').length;
  const revokes = overrides.size - grants;
  const dirty = overrides.size !== initialOverrides.length || initialOverrides.some((o) => overrides.get(o.key) !== o.mode);
  // What they'd have after saving: today's effective set with pending grants added and revokes removed.
  const pendingEffective = new Set(effective);
  for (const [key, mode] of overrides) {
    if (mode === 'GRANT') pendingEffective.add(key);
    else pendingEffective.delete(key);
  }

  const onChange = (key: string, mode: OverrideMode) =>
    setOverrides_((prev) => {
      const next = new Map(prev);
      if (mode === null) next.delete(key);
      else next.set(key, mode);
      return next;
    });

  const save = () =>
    setOverrides.mutate(
      { userId, overrides: [...overrides.entries()].map(([key, mode]) => ({ key, mode })) },
      {
        onSuccess: () => toast.success('Overrides updated'),
        onError: (err) => toast.error(toIamError(err).message),
      },
    );

  return (
    <PanelCard icon={KeyRound} accent="success" title="Permission overrides" delay={0.15} right={dirty ? <UnsavedChip /> : undefined}>
      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] font-bold">
        <span className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: 'color-mix(in oklch, var(--success) 15%, transparent)', color: 'var(--success)' }}>{grants} grant{grants === 1 ? '' : 's'}</span>
        <span className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: 'color-mix(in oklch, var(--destructive) 15%, transparent)', color: 'var(--destructive)' }}>{revokes} revoke{revokes === 1 ? '' : 's'}</span>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-primary">{pendingEffective.size} effective</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Everything else inherits from their roles. The round tick shows what this user currently has — click it for a one-tap grant/revoke, or use the control to reset a permission back to Inherit.
      </p>
      <PermissionOverridesTree overrides={overrides} onChange={onChange} effective={effectiveSet} disabled={setOverrides.isPending} />
      <LoadingButton size="sm" onClick={save} loading={setOverrides.isPending} loadingText="Saving…">
        Save overrides
      </LoadingButton>
    </PanelCard>
  );
}
