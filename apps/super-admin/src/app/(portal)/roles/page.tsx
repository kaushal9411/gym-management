'use client';

/**
 * /roles — Roles & Admins. Banner + KPI tiles, then Roles | Admins tabs.
 * Roles: role cards (type, permission count, admins) + permission matrix (roles x permissions, from the real catalog) +
 * inline "create custom role" panel. Admins: admin cards (role select, status toggle, last login) + inline create panel +
 * one-time credentials panel. All dialogs replaced by inline panels; suspending an admin now asks for inline confirmation.
 * Logic/hooks unchanged (create role, create admin, change role, set status, pagination).
 * Dropped: per-role permission editing (a hook exists but the old page never exposed it), admin search (not in old UI).
 */
import * as React from 'react';
import { toast } from 'sonner';
import { Check, KeyRound, Plus, ShieldCheck, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/pagination';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { fmtInt } from '@/features/dashboard/components/format';
import { Avatar, Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { useNow } from '@/features/dashboard/components/use-now';
import { BANNER_BTN, Banner, ConfirmRow, relTime } from '@/features/payments/components/pay-kit';
import { toRoleError, useAdmins, useCreateAdmin, useCreateRole, usePermissionCatalog, useRoles, useSetAdminStatus, useUpdateAdminRole } from '@/features/roles/hooks/use-roles';
import type { AdminUserListItem } from '@/features/roles/types';
import { FIELD, Field, KpiGrid, TEXTAREA, fmtDateTime } from '@/features/shell/components/page-kit';
import { ErrorNote } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { cn } from '@/lib/utils';

const STATUS_TONE = { ACTIVE: 'green', SUSPENDED: 'amber', DEACTIVATED: 'slate' } as const;

function RolesTab({ creating, setCreating }: { creating: boolean; setCreating: (v: boolean) => void }) {
  const rolesQ = useRoles();
  const { data: permissions } = usePermissionCatalog();
  const createRole = useCreateRole();
  const roles = rolesQ.data;

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set());

  const togglePermission = (key: string) =>
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const submit = () =>
    createRole.mutate(
      { name, description: description || undefined, permissionKeys: Array.from(selectedKeys) },
      {
        onSuccess: () => { toast.success('Custom role created'); setCreating(false); setName(''); setDescription(''); setSelectedKeys(new Set()); },
        onError: (err) => toast.error(toRoleError(err).message),
      },
    );

  const groups = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const p of permissions ?? []) {
      const g = p.key.split(':')[0] ?? 'other';
      m.set(g, [...(m.get(g) ?? []), p.key]);
    }
    return [...m.entries()];
  }, [permissions]);
  const roleKeys = React.useMemo(() => new Map((roles ?? []).map((r) => [r.id, new Set(r.rolePermissions.map((rp) => rp.permission.key))])), [roles]);

  if (rolesQ.isError) return <ErrorNote what="roles" message={rolesQ.error?.message} onRetry={() => void rolesQ.refetch()} />;
  if (rolesQ.isPending || !roles) return <Skeleton className="h-64 rounded-[14px]" />;

  return (
    <div className="space-y-4">
      {creating ? (
        <Panel title="Create custom role" index={0} right={<Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>}>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" htmlFor="role-name"><input id="role-name" className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="REGIONAL_MANAGER" /></Field>
              <Field label="Description (optional)" htmlFor="role-desc"><input id="role-desc" className={FIELD} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-muted-foreground">Permissions ({selectedKeys.size} selected)</legend>
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border p-3">
                {groups.map(([g, keys]) => (
                  <div key={g}>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{g}</p>
                    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                      {keys.map((k) => (
                        <label key={k} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selectedKeys.has(k)} onChange={() => togglePermission(k)} />{k}</label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
            <Button onClick={submit} disabled={createRole.isPending || !name}>{createRole.isPending ? 'Creating…' : 'Create role'}</Button>
          </div>
        </Panel>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Roles">
        {roles.map((r) => (
          <li key={r.id} className="min-w-0 rounded-[14px] border bg-card p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
              <p className="min-w-0 flex-1 truncate font-semibold">{r.name}</p>
              <Chip tone={r.isSystem ? 'blue' : 'violet'}>{r.isSystem ? 'System' : 'Custom'}</Chip>
            </div>
            {r.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</p> : null}
            <div className="mt-3 flex gap-4 text-[13px]">
              <span><b className="tabular-nums">{r.rolePermissions.length}</b> <span className="text-muted-foreground">permissions</span></span>
              <span><b className="tabular-nums">{r._count?.adminUsers ?? 0}</b> <span className="text-muted-foreground">admins</span></span>
            </div>
          </li>
        ))}
      </ul>

      <Panel title="Permission matrix" hint="what each role can do" index={1} bodyClassName="px-0 pb-0 pt-2">
        {groups.length === 0 ? (
          <div className="p-4"><EmptyNote>No permissions in the catalog.</EmptyNote></div>
        ) : (
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 top-0 z-20 border-b bg-card px-4 py-2 text-left font-semibold text-muted-foreground">Permission</th>
                  {roles.map((r) => <th key={r.id} scope="col" className="sticky top-0 z-10 whitespace-nowrap border-b bg-card px-3 py-2 text-center font-semibold">{r.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {groups.map(([g, keys]) => (
                  <React.Fragment key={g}>
                    <tr><th colSpan={roles.length + 1} scope="colgroup" className="bg-muted/50 px-4 py-1 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{g}</th></tr>
                    {keys.map((k) => (
                      <tr key={k} className="hover:bg-muted/30">
                        <th scope="row" className="sticky left-0 border-b bg-card px-4 py-1.5 text-left font-mono font-normal">{k}</th>
                        {roles.map((r) => {
                          const has = roleKeys.get(r.id)?.has(k);
                          return (
                            <td key={r.id} className="border-b px-3 py-1.5 text-center">
                              {has ? <Check className="mx-auto size-4 text-emerald-600 dark:text-emerald-400" aria-label="granted" /> : <span className="text-muted-foreground/40" aria-label="not granted">–</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function AdminsTab({ creating, setCreating }: { creating: boolean; setCreating: (v: boolean) => void }) {
  const { data: roles } = useRoles();
  const now = useNow();
  const [page, setPage] = React.useState(1);
  const adminsQ = useAdmins({ page, limit: 20 });
  const createAdmin = useCreateAdmin();
  const updateRole = useUpdateAdminRole();
  const setStatus = useSetAdminStatus();

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [roleId, setRoleId] = React.useState('');
  const [creds, setCreds] = React.useState<{ email: string; temporaryPassword: string } | null>(null);
  const [confirmSuspend, setConfirmSuspend] = React.useState<string | null>(null);

  const submit = () =>
    createAdmin.mutate(
      { name, email, roleId },
      {
        onSuccess: (result) => { toast.success('Admin created'); setCreds({ email: result.email, temporaryPassword: result.temporaryPassword }); setCreating(false); setName(''); setEmail(''); },
        onError: (err) => toast.error(toRoleError(err).message),
      },
    );

  const toggle = (a: AdminUserListItem) =>
    setStatus.mutate(
      { adminId: a.id, status: a.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' },
      { onSuccess: () => setConfirmSuspend(null), onError: (err) => toast.error(toRoleError(err).message) },
    );

  if (adminsQ.isError) return <ErrorNote what="admins" message={adminsQ.error?.message} onRetry={() => void adminsQ.refetch()} />;
  if (adminsQ.isPending || !adminsQ.data) return <Skeleton className="h-64 rounded-[14px]" />;
  const admins = adminsQ.data;

  return (
    <div className="space-y-4">
      {creds ? (
        <div role="status" className="space-y-1.5 rounded-[14px] border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
          <p className="font-semibold">Admin created — share these credentials securely; they are shown only once.</p>
          <p><span className="opacity-70">Email:</span> {creds.email}</p>
          <p className="font-mono"><span className="font-sans opacity-70">Temporary password:</span> {creds.temporaryPassword}</p>
          <Button size="sm" variant="outline" onClick={() => setCreds(null)}>Dismiss</Button>
        </div>
      ) : null}

      {creating ? (
        <Panel title="Create admin account" index={0} right={<Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" htmlFor="adm-name"><input id="adm-name" className={FIELD} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Email" htmlFor="adm-email"><input id="adm-email" type="email" className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Role" htmlFor="adm-role">
              <select id="adm-role" className={FIELD} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">Select a role…</option>
                {(roles ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
          </div>
          <Button className="mt-3" onClick={submit} disabled={createAdmin.isPending || !name || !email || !roleId}>{createAdmin.isPending ? 'Creating…' : 'Create admin'}</Button>
        </Panel>
      ) : null}

      {admins.items.length === 0 ? (
        <EmptyNote>No admin accounts yet.</EmptyNote>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Admins">
          {admins.items.map((a) => (
            <li key={a.id} className="min-w-0 space-y-3 rounded-[14px] border bg-card p-4">
              <div className="flex items-center gap-3">
                <Avatar name={a.name} seed={a.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                </div>
                <Chip tone={STATUS_TONE[a.status]}>{a.status === 'ACTIVE' ? 'Active' : a.status === 'SUSPENDED' ? 'Suspended' : 'Deactivated'}</Chip>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor={`role-${a.id}`} className="sr-only">Role for {a.name}</label>
                <select
                  id={`role-${a.id}`}
                  className={cn(FIELD, 'h-8 text-xs')}
                  value={roles?.find((r) => r.name === a.role)?.id ?? ''}
                  onChange={(e) => updateRole.mutate({ adminId: a.id, roleId: e.target.value }, { onError: (err) => toast.error(toRoleError(err).message) })}
                >
                  {(roles ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <p className="text-xs text-muted-foreground" title={fmtDateTime(a.lastLoginAt)}>Last login: {a.lastLoginAt ? relTime(a.lastLoginAt, now) || fmtDateTime(a.lastLoginAt) : 'Never'}</p>
              {confirmSuspend === a.id ? (
                <ConfirmRow text={`Suspend ${a.name}'s access to the portal?`} confirmLabel="Suspend" busy={setStatus.isPending} onCancel={() => setConfirmSuspend(null)} onConfirm={() => toggle(a)} />
              ) : a.status === 'ACTIVE' ? (
                <Button size="sm" variant="outline" onClick={() => setConfirmSuspend(a.id)}><X className="mr-1 size-3.5" aria-hidden />Suspend</Button>
              ) : (
                <Button size="sm" variant="outline" disabled={setStatus.isPending} onClick={() => toggle(a)}>Reactivate</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pagination page={admins.page} totalPages={admins.totalPages} onPageChange={setPage} />
    </div>
  );
}

export default function RolesPage() {
  const [tab, setTab] = React.useState<'roles' | 'admins'>('roles');
  const [creating, setCreating] = React.useState(false);
  const rolesQ = useRoles();
  const adminsQ = useAdmins({ page: 1, limit: 20 });
  const permsQ = usePermissionCatalog();

  const roles = rolesQ.data ?? [];
  const custom = roles.filter((r) => !r.isSystem).length;
  const adminsTotal = adminsQ.data?.total ?? 0;
  const tabCls = (on: boolean) => cn('-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring', on ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground');

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <Banner
        actions={
          <button type="button" className={BANNER_BTN} onClick={() => setCreating((v) => !v)} aria-expanded={creating}>
            <Plus className="size-4" aria-hidden />{tab === 'roles' ? 'Create custom role' : 'Create admin'}
          </button>
        }
      >
        <h1 className="text-2xl font-bold tracking-tight">Roles &amp; Admins</h1>
        <p className="mt-0.5 text-[13px] text-teal-100">System + custom roles, permissions, and admin staff accounts.</p>
      </Banner>

      <KpiGrid>
        <KpiCard index={0} label="Roles" value={roles.length} format={fmtInt} fallbackCaption={`${roles.length - custom} system · ${custom} custom`} color="var(--chart-1)" />
        <KpiCard index={1} label="Admin accounts" value={adminsTotal} format={fmtInt} fallbackCaption="platform team" color="var(--chart-2)" />
        <KpiCard index={2} label="Permissions" value={permsQ.data?.length ?? 0} format={fmtInt} fallbackCaption="in the catalog" color="var(--chart-3)" />
        <KpiCard index={3} label="Custom roles" value={custom} format={fmtInt} fallbackCaption="beyond system roles" color="var(--chart-4)" />
      </KpiGrid>

      <div className="flex flex-wrap items-center gap-x-1 border-b" role="tablist" aria-label="Roles and admins">
        {(['roles', 'admins'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tabCls(tab === t)} onClick={() => { setTab(t); setCreating(false); }}>
            {t === 'roles' ? <KeyRound className="size-3.5" aria-hidden /> : null}{t === 'roles' ? 'Roles' : 'Admins'}
          </button>
        ))}
      </div>

      <div role="tabpanel">{tab === 'roles' ? <RolesTab creating={creating} setCreating={setCreating} /> : <AdminsTab creating={creating} setCreating={setCreating} />}</div>
    </div>
  );
}
