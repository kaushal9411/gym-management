'use client';

import { Lock } from 'lucide-react';
import { toast } from 'sonner';

import { toTenantError } from '@/features/tenants/hooks/use-tenants';
import { useTenantModules, useToggleModule, type ModuleRow } from '@/features/tenants/api/detail';
import { Chip } from '@/features/dashboard/components/ui';
import { cn } from '@/lib/utils';
import { READONLY_TIP, Switch } from './confirm';

/**
 * Shared modules editor. `compact` = control-panel switch list; `full` = grouped cards for the Modules tab.
 * Guarded modules (dashboard/members/staff/branches) are locked on; platform-disabled ones are unavailable
 * (the platform kill-switch ANDs over the tenant toggle, so flipping it would have no effect).
 */
export function ModulesEditor({ tenantId, canManage, layout }: { tenantId: string; canManage: boolean; layout: 'compact' | 'full' }) {
  const q = useTenantModules(tenantId);
  const toggle = useToggleModule(tenantId);

  if (q.isLoading) return <div className="h-32 animate-pulse rounded-lg bg-muted" aria-busy="true" />;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">Could not load modules.</p>;

  const flip = async (m: ModuleRow, enabled: boolean) => {
    const id = toast.loading(`${enabled ? 'Enabling' : 'Disabling'} ${m.label}…`);
    try {
      await toggle.mutateAsync({ key: m.key, enabled });
      toast.success(`${m.label} ${enabled ? 'enabled' : 'disabled'}`, { id });
    } catch (e) { toast.error(toTenantError(e).message, { id }); }
  };

  const tip = (m: ModuleRow) => (m.guarded ? 'Core module — cannot be disabled' : !m.platformEnabled ? 'Disabled platform-wide by a feature flag' : !canManage ? READONLY_TIP : undefined);
  const off = (m: ModuleRow) => !canManage || m.guarded || !m.platformEnabled || (toggle.isPending && toggle.variables?.key === m.key);

  const row = (m: ModuleRow) => (
    <div key={m.key} className={cn('flex items-center gap-2.5 py-1.5 text-[13px]', layout === 'full' && 'rounded-lg border px-3 py-2.5')}>
      <Switch checked={m.enabled && m.platformEnabled} onChange={(v) => void flip(m, v)} disabled={off(m)} label={`${m.label} module`} title={tip(m)} />
      <span className="min-w-0 flex-1 truncate">{m.label}</span>
      {m.guarded ? <span title="Core module — cannot be disabled" className="text-muted-foreground"><Lock className="size-3.5" aria-label="Locked: core module" /></span> : null}
      {!m.platformEnabled ? <Chip tone="slate">unavailable</Chip> : m.overridden ? <Chip tone="violet">overridden</Chip> : null}
      {layout === 'full' ? <span className="hidden text-[11px] text-muted-foreground sm:inline">plan default: {m.planDefault ? 'on' : 'off'}</span> : null}
    </div>
  );

  const core = q.data.filter((m) => m.guarded);
  const optional = q.data.filter((m) => !m.guarded);
  if (layout === 'compact') return <div className="grid gap-x-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{[...optional, ...core].map(row)}</div>;
  return (
    <div className="space-y-5">
      <div><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Optional modules</h3><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{optional.map(row)}</div></div>
      <div><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Core (locked on)</h3><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{core.map(row)}</div></div>
    </div>
  );
}
