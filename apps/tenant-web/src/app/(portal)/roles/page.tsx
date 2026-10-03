'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Copy, KeyRound, Lock, Pencil, Plus, Shield, Trash2, Users, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { IamHero } from '@/features/iam/components/iam-hero';
import { displayRoleName, roleBlurb } from '@/features/iam/components/users-overview';
import { toIamError, useCloneRole, useDeleteRole, usePermissionRegistry, useRoles } from '@/features/iam/hooks/use-iam';
import { type Accent, CountUp, IconChip, ProgressBar, accentVar, tint } from '@/features/members/components/detail/detail-ui';

const ROLE_TONES: Accent[] = ['destructive', 'primary', 'aqua', 'violet', 'success', 'warning'];

export default function RolesPage() {
  const { hasPermission } = usePermissions();
  const roles = useRoles();
  const registry = usePermissionRegistry({ enabled: hasPermission('permissions:read') });
  const cloneRole = useCloneRole();
  const deleteRole = useDeleteRole();
  const canManage = hasPermission('roles:manage-custom');

  const list = roles.data ?? [];
  const totalPermissions = registry.data?.groups.reduce((sum, g) => sum + g.permissions.length, 0) ?? Math.max(...list.map((r) => r.permissions.length), 1);
  const tiles: Array<{ label: string; value: number; icon: LucideIcon; accent: Accent }> = [
    { label: 'Roles', value: list.length, icon: Shield, accent: 'primary' },
    { label: 'System roles', value: list.filter((r) => r.isSystem).length, icon: Lock, accent: 'violet' },
    { label: 'Custom roles', value: list.filter((r) => !r.isSystem).length, icon: Copy, accent: 'warning' },
    { label: 'People assigned', value: list.reduce((s, r) => s + r.userCount, 0), icon: Users, accent: 'aqua' },
  ];

  return (
    <div className="w-full space-y-5">
      <IamHero
        title="Roles"
        subtitle="System roles are shared and immutable. Clone one to customize it."
        actions={
          canManage ? (
            <Button size="sm" asChild data-solid className="border-0 bg-white text-indigo-700 shadow-lg hover:bg-white/90">
              <Link href="/roles/new">
                <Plus className="size-4" /> New role
              </Link>
            </Button>
          ) : null
        }
      />

      <section aria-label="Role figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.45, delay: 0.04 * i }}
            className="rounded-2xl border p-3.5 shadow-xs"
            style={{ backgroundImage: `linear-gradient(160deg, ${tint(t.accent, 13)}, transparent 72%)`, borderColor: tint(t.accent, 22) }}
          >
            <IconChip icon={t.icon} accent={t.accent} className="size-8" />
            <div className="mt-2.5 text-2xl font-extrabold tabular-nums" style={{ color: accentVar(t.accent) }}>
              {roles.isPending ? <Skeleton className="h-7 w-10" /> : <CountUp value={t.value} />}
            </div>
            <div className="text-xs font-medium text-muted-foreground">{t.label}</div>
          </motion.div>
        ))}
      </section>

      {roles.error ? (
        <EmptyState
          icon={KeyRound}
          title="Couldn't load roles"
          description={roles.error instanceof Error ? roles.error.message : 'Something went wrong loading this data.'}
          action={
            <Button variant="outline" size="sm" onClick={() => roles.refetch()}>
              Retry
            </Button>
          }
        />
      ) : roles.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-60 rounded-3xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={Shield} title="No roles yet." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((r, i) => {
            const tone = ROLE_TONES[i % ROLE_TONES.length]!;
            const editable = canManage && !r.isSystem;
            return (
              <motion.article
                key={r.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5 }}
                transition={{ duration: 0.45, delay: Math.min(i * 0.05, 0.5) }}
                className="relative flex flex-col gap-3 overflow-hidden rounded-3xl border bg-card p-[18px] shadow-xs transition-shadow hover:shadow-xl"
              >
                <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-[130px] rounded-full" style={{ backgroundImage: `radial-gradient(circle, ${tint(tone, 22)}, transparent 70%)` }} />
                <div className="relative flex items-center gap-3">
                  <IconChip icon={Shield} accent={tone} className="size-11 rounded-2xl" />
                  <div className="min-w-0">
                    {editable ? (
                      <Link href={`/roles/${r.id}`} className="block truncate text-[17px] font-extrabold tracking-tight hover:underline">{displayRoleName(r.name)}</Link>
                    ) : (
                      <h3 className="truncate text-[17px] font-extrabold tracking-tight">{displayRoleName(r.name)}</h3>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: tint(r.isSystem ? 'primary' : 'violet', 14), color: accentVar(r.isSystem ? 'primary' : 'violet') }}>{r.isSystem ? 'System' : 'Custom'}</span>
                      {r.isDefault ? <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: tint('success', 14), color: 'var(--success)' }}>Default</span> : null}
                      {!r.isActive ? <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: tint('destructive', 14), color: 'var(--destructive)' }}>Inactive</span> : null}
                    </div>
                  </div>
                </div>
                <p className="relative min-h-10 text-[13px] text-muted-foreground">{roleBlurb(r)}</p>
                <div className="relative">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Permissions</span>
                    <span className="tabular-nums">{r.permissions.length} of {totalPermissions}</span>
                  </div>
                  <ProgressBar percent={(r.permissions.length / Math.max(totalPermissions, 1)) * 100} accent={tone} />
                </div>
                <div className="relative grid grid-cols-2 gap-2">
                  {[
                    { v: r.userCount, l: 'People' },
                    { v: `${Math.round((r.permissions.length / Math.max(totalPermissions, 1)) * 100)}%`, l: 'Access' },
                  ].map((s) => (
                    <div key={s.l} className="rounded-xl border p-2.5" style={{ backgroundColor: tint(tone, 8), borderColor: tint(tone, 16) }}>
                      <b className="block text-lg font-extrabold tabular-nums">{s.v}</b>
                      <span className="text-[11.5px] text-muted-foreground">{s.l}</span>
                    </div>
                  ))}
                </div>
                {canManage ? (
                  <div className="relative mt-auto flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-w-0 flex-1"
                      aria-label={`Clone ${r.name}`}
                      disabled={cloneRole.isPending}
                      onClick={() =>
                        cloneRole.mutate(
                          { roleId: r.id },
                          { onSuccess: (created) => toast.success(`Cloned as "${created.name}"`), onError: (err) => toast.error(toIamError(err).message) },
                        )
                      }
                    >
                      <Copy className="size-3.5" /> Clone
                    </Button>
                    {editable ? (
                      <>
                        <Button asChild size="sm" className="min-w-0 flex-1 border-0 text-white shadow-md" style={{ backgroundImage: 'linear-gradient(120deg, var(--primary), var(--chart-7))' }}>
                          <Link href={`/roles/${r.id}`}>
                            <Pencil className="size-3.5" /> Edit
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 shrink-0 text-destructive"
                          aria-label={`Delete ${r.name}`}
                          disabled={deleteRole.isPending}
                          onClick={() =>
                            deleteRole.mutate(r.id, { onSuccess: () => toast.success('Role deleted'), onError: (err) => toast.error(toIamError(err).message) })
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    ) : (
                      <span className="flex flex-1 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">Read only</span>
                    )}
                  </div>
                ) : null}
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
}
