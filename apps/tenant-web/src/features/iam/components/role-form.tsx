'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Check, KeyRound, Lock, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { PanelCard, ProgressBar } from '@/features/members/components/detail/detail-ui';
import { toIamError, useCreateRole, usePermissionRegistry, useUpdateRole } from '../hooks/use-iam';
import type { RoleDto } from '../types';
import { CoverageRing, HeroChip, HeroShell, InfoBanner, UnsavedChip } from './iam-detail-ui';
import { PermissionPicker } from './permission-picker';
import { displayRoleName } from './users-overview';

function sameSet(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every((k) => b.has(k));
}

function ToggleCard({ id, checked, onChange, disabled, title, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; disabled: boolean; title: string; hint: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition-colors disabled:cursor-default disabled:opacity-60"
      style={{ borderColor: checked ? 'var(--primary)' : 'var(--border)', backgroundColor: checked ? 'color-mix(in oklch, var(--primary) 8%, transparent)' : undefined }}
    >
      <span className="relative h-5 w-9 shrink-0 rounded-full transition-colors" style={{ backgroundColor: checked ? 'var(--primary)' : 'var(--muted-foreground)', opacity: checked ? 1 : 0.4 }}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      <span className="min-w-0">
        <b className="block text-sm font-semibold">{title}</b>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

/**
 * Create + edit form for roles. Custom roles are editable; system roles (and users without `roles:manage-custom`,
 * the key the API and /roles page use for every mutation) get the same layout read-only.
 */
export function RoleForm({ existing }: { existing?: RoleDto }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { hasPermission } = usePermissions();
  const registry = usePermissionRegistry();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const isPending = createRole.isPending || updateRole.isPending;
  const canManage = hasPermission('roles:manage-custom');
  const readOnly = !!existing?.isSystem || !canManage;

  const [name, setName] = React.useState(existing?.name ?? '');
  const [description, setDescription] = React.useState(existing?.description ?? '');
  const [priority, setPriority] = React.useState(existing?.priority ?? 0);
  const [isDefault, setIsDefault] = React.useState(existing?.isDefault ?? false);
  const [isActive, setIsActive] = React.useState(existing?.isActive ?? true);
  const [permissions, setPermissions] = React.useState(new Set(existing?.permissions ?? []));
  const [error, setError] = React.useState<string | null>(null);
  const baseline = React.useMemo(() => new Set(existing?.permissions ?? []), [existing]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
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

  const added = [...permissions].filter((k) => !baseline.has(k)).length;
  const removed = [...baseline].filter((k) => !permissions.has(k)).length;
  const basicsDirty =
    name !== (existing?.name ?? '') ||
    description !== (existing?.description ?? '') ||
    priority !== (existing?.priority ?? 0) ||
    isDefault !== (existing?.isDefault ?? false) ||
    isActive !== (existing?.isActive ?? true);
  const dirty = basicsDirty || !sameSet(permissions, baseline);
  const changedCount = added + removed;

  const groups = registry.data?.groups ?? [];
  const registryKeys = new Set(groups.flatMap((g) => g.permissions.map((p) => p.key)));
  const total = registryKeys.size;
  const covered = [...permissions].filter((k) => registryKeys.has(k)).length;
  const percent = total ? (covered / total) * 100 : 0;
  const nameOk = name.trim().length >= 2;

  return (
    <div className="w-full space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/roles">
          <ArrowLeft className="size-4" /> Back to roles
        </Link>
      </Button>

      <HeroShell
        title={existing ? displayRoleName(existing.name) : 'New custom role'}
        subtitle={existing ? existing.description || 'No description.' : 'Name it, then pick exactly which permissions it grants.'}
      >
        <HeroChip icon={existing?.isSystem ? Lock : SlidersHorizontal}>{existing?.isSystem ? 'System' : 'Custom'}</HeroChip>
        {existing?.isDefault ? <HeroChip icon={Check}>Default for new users</HeroChip> : null}
        {existing && !existing.isActive ? <HeroChip>Inactive</HeroChip> : null}
        <HeroChip icon={KeyRound}>
          {permissions.size} permission{permissions.size === 1 ? '' : 's'}
        </HeroChip>
        {existing ? (
          <HeroChip icon={Users}>
            {existing.userCount} {existing.userCount === 1 ? 'person' : 'people'} assigned
          </HeroChip>
        ) : null}
      </HeroShell>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={submit} noValidate className="min-w-0 space-y-4">
          {existing?.isSystem ? (
            <InfoBanner>System roles are immutable — clone the role instead.</InfoBanner>
          ) : !canManage ? (
            <InfoBanner>You don&apos;t have permission to create or edit custom roles, so this is read-only.</InfoBanner>
          ) : null}
          {error ? (
            <motion.p role="alert" initial={reduce ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              {error}
            </motion.p>
          ) : null}

          <PanelCard icon={SlidersHorizontal} accent="primary" title="Basics" delay={0} right={basicsDirty && !readOnly ? <UnsavedChip /> : undefined}>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="role-name" required>Name</Label>
                <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} disabled={isPending} readOnly={readOnly} aria-invalid={(!readOnly && name !== '' && !nameOk) || undefined} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="role-description">Description</Label>
                <Input id="role-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this role for?" disabled={isPending} readOnly={readOnly} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-priority">Priority</Label>
                <Input id="role-priority" type="number" min={0} max={1000} value={priority} onChange={(e) => setPriority(Number(e.target.value))} disabled={isPending} readOnly={readOnly} />
              </div>
              <div className={`grid gap-2 sm:col-span-2 ${existing ? 'sm:grid-cols-2' : ''}`}>
                <ToggleCard id="role-default" checked={isDefault} onChange={setIsDefault} disabled={isPending || readOnly} title="Default role" hint="Pre-selected for new users" />
                {existing ? <ToggleCard id="role-active" checked={isActive} onChange={setIsActive} disabled={isPending || readOnly} title="Active" hint="Assignable to people" /> : null}
              </div>
            </div>
          </PanelCard>

          <PanelCard
            icon={ShieldCheck}
            accent="violet"
            title="Permissions"
            delay={0.07}
            right={
              <>
                {!readOnly && changedCount > 0 ? <UnsavedChip /> : null}
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">{permissions.size} selected</span>
              </>
            }
          >
            <PermissionPicker selected={permissions} onChange={setPermissions} baseline={existing ? baseline : undefined} readOnly={readOnly} disabled={isPending} />
          </PanelCard>

          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3.5 shadow-lg backdrop-blur">
            <Button type="button" variant="outline" asChild disabled={isPending}>
              <Link href="/roles">{readOnly ? 'Back' : 'Cancel'}</Link>
            </Button>
            {!readOnly ? (
              <div className="flex items-center gap-3">
                {dirty ? <span className="hidden text-xs font-semibold sm:inline" style={{ color: 'var(--warning)' }}>Unsaved changes</span> : null}
                <LoadingButton type="submit" loading={isPending} loadingText="Saving…" disabled={!nameOk} className="border-0 px-6 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' }}>
                  <Check className="size-4" /> {existing ? 'Save role' : 'Create role'}
                </LoadingButton>
              </div>
            ) : null}
          </div>
        </form>

        <aside aria-label="Permission summary" className="lg:sticky lg:top-3">
          <PanelCard icon={KeyRound} accent="success" title="Coverage" delay={0.1}>
            <div className="flex items-center gap-4">
              <CoverageRing percent={percent} />
              <div className="min-w-0">
                <p className="text-lg font-extrabold tabular-nums">
                  {covered} of {total || '…'}
                </p>
                <p className="text-xs text-muted-foreground">permissions granted</p>
                {existing && !readOnly ? (
                  <p className="mt-1 text-xs font-semibold tabular-nums" style={{ color: changedCount ? 'var(--warning)' : undefined }}>
                    {changedCount ? `${changedCount} changed since load (+${added} / −${removed})` : 'No changes yet'}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="max-h-[46vh] space-y-2.5 overflow-y-auto pr-1">
              {groups.map((g) => {
                const n = g.permissions.filter((p) => permissions.has(p.key)).length;
                return (
                  <div key={g.resource} className="space-y-1">
                    <div className="flex justify-between text-[12px]">
                      <b className="font-semibold capitalize">{g.resource.replace(/-/g, ' ')}</b>
                      <span className="tabular-nums text-muted-foreground">{n}/{g.permissions.length}</span>
                    </div>
                    <ProgressBar percent={(n / g.permissions.length) * 100} accent={n === g.permissions.length ? 'success' : 'violet'} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </PanelCard>
        </aside>
      </div>
    </div>
  );
}
