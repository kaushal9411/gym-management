'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { CalendarPlus, ExternalLink, KeyRound, Loader2, LogOut, Minus, Plus, Power, ShieldAlert, UserCog, Wrench, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import {
  toTenantError, useExtendTrial, useForceLogout, useImpersonateTenant, useReactivateTenant, useResetOwnerPassword, useSetMaintenance, useSuspendTenant, useTenant,
} from '@/features/tenants/hooks/use-tenants';
import type { TenantStatus } from '@/features/tenants/types';
import { cn } from '@/lib/utils';
import type { ConsoleIntent, TenantRef } from './command-console';
import { Chip, type ChipTone } from './ui';

const STATUS_TONE: Record<TenantStatus, ChipTone> = { ACTIVE: 'green', TRIAL: 'amber', PAST_DUE: 'red', SUSPENDED: 'red', CANCELLED: 'slate' };
type Action = 'suspend' | 'reactivate' | 'maintenance' | 'logout' | 'reset' | 'impersonate';
const d10 = (s: string | null | undefined) => (s ? new Date(s).toISOString().slice(0, 10) : '—');

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-1.5 text-sm last:border-0">
      <dt className="shrink-0 text-xs font-medium capitalize text-muted-foreground">{k}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{v}</dd>
    </div>
  );
}

function Group({ id, title, children, flash }: { id: string; title: string; children: React.ReactNode; flash: boolean }) {
  return (
    <section id={id} aria-label={title} className={cn('min-w-0 scroll-mt-20 rounded-xl border p-3.5 transition-shadow', flash && 'ring-2 ring-ring')}>
      <h3 className="mb-2.5 text-[13px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

interface ConfirmCfg { title: string; text: React.ReactNode; label: string; destructive?: boolean; slug?: boolean; reason?: boolean; pending: boolean; run: () => void }

/** Inline confirmation row (no modal): optional typed-slug + reason, Confirm / Cancel. */
function InlineConfirm({ cfg, slug, reason, setReason, onCancel }: { cfg: ConfirmCfg; slug: string; reason: string; setReason: (v: string) => void; onCancel: () => void }) {
  const [typed, setTyped] = useState('');
  const typedId = useId();
  const armed = !cfg.slug || typed.trim() === slug;
  return (
    <div role="group" aria-label={cfg.title} className={cn('mt-3 space-y-2.5 rounded-lg border p-3 text-sm', cfg.destructive ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10' : 'bg-muted/50')}>
      <p className="font-semibold">{cfg.title}</p>
      <p className="text-muted-foreground">{cfg.text}</p>
      {cfg.reason ? <Input placeholder="Reason (optional)" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" /> : null}
      {cfg.slug ? (
        <div className="space-y-1">
          <label htmlFor={typedId} className="block text-xs text-muted-foreground">Type <code className="rounded bg-card px-1 font-mono text-foreground">{slug}</code> to confirm</label>
          <Input id={typedId} className="font-mono" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={cfg.destructive ? 'destructive' : 'default'} disabled={!armed || cfg.pending} onClick={cfg.run}>
          {cfg.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}{cfg.label}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={cfg.pending} onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

interface Props { tenant: TenantRef; focus: { intent: ConsoleIntent; nonce: number } | null; onClose: () => void }

/** Inline tenant control card (in page flow, no overlay). Rendered only while the user has a tenant selected; every mutation is click-driven and confirmed inline. */
export function TenantControlCard({ tenant, focus, onClose }: Props) {
  const qc = useQueryClient();
  const canManage = useHasPermission('tenants:manage');
  const { data: t, isLoading, isError } = useTenant(tenant.id);
  const rootRef = useRef<HTMLElement>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState('');
  const [flash, setFlash] = useState<'access' | 'subscription' | null>(null);

  const suspend = useSuspendTenant();
  const reactivate = useReactivateTenant();
  const extend = useExtendTrial();
  const maintenance = useSetMaintenance();
  const forceLogout = useForceLogout();
  const reset = useResetOwnerPassword();
  const impersonate = useImpersonateTenant();

  // Selecting a tenant is user-initiated; bring the card into view once on mount.
  useEffect(() => { rootRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, []);
  // Quick action from the command bar: focus/highlight the matching group only (never mutates).
  useEffect(() => {
    if (!focus) return;
    const group = focus.intent === 'extend' ? 'subscription' : 'access';
    const el = rootRef.current?.querySelector<HTMLElement>(`#grp-${group}`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    el?.querySelector<HTMLElement>('button:not(:disabled), input')?.focus({ preventScroll: true });
    setFlash(group);
    const id = window.setTimeout(() => setFlash(null), 1600);
    return () => window.clearTimeout(id);
  }, [focus]);

  const status = t?.status ?? tenant.status;
  const sub = t?.subscriptions?.[0];
  const owner = t?.users?.[0];
  const maint = t?.maintenanceMode ?? false;
  const busy = suspend.isPending || reactivate.isPending || extend.isPending || maintenance.isPending || forceLogout.isPending || reset.isPending || impersonate.isPending;
  const off = !canManage || !t || busy;

  const done = () => {
    setAction(null);
    setReason('');
    void qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'tenants'] });
  };
  const run = async (label: string, fn: () => Promise<unknown>, after?: (r: unknown) => void) => {
    const id = toast.loading(`${label}…`);
    try {
      const r = await fn();
      toast.success(`${label} — done`, { id });
      after?.(r);
      done();
    } catch (e) {
      toast.error(toTenantError(e).message, { id });
    }
  };

  const confirms: Record<Action, ConfirmCfg> = {
    suspend: { title: 'Suspend tenant', destructive: true, slug: true, label: 'Suspend', pending: suspend.isPending, text: <>Blocks staff and members of <b>{tenant.name}</b> from signing in until reactivated.</>, run: () => void run('Suspending tenant', () => suspend.mutateAsync(tenant.id)) },
    reactivate: { title: 'Reactivate tenant', label: 'Reactivate', pending: reactivate.isPending, text: <>Restore access for <b>{tenant.name}</b>.</>, run: () => void run('Reactivating tenant', () => reactivate.mutateAsync(tenant.id)) },
    maintenance: { title: maint ? 'Disable maintenance mode' : 'Enable maintenance mode', slug: !maint, reason: true, label: maint ? 'Disable' : 'Enable', pending: maintenance.isPending, text: maint ? <>Bring <b>{tenant.name}</b> back online.</> : <>Users of <b>{tenant.name}</b> will see a maintenance screen.</>, run: () => void run('Updating maintenance mode', () => maintenance.mutateAsync({ tenantId: tenant.id, enabled: !maint, reason: reason.trim() || undefined })) },
    logout: { title: 'Force logout', destructive: true, slug: true, label: 'Force logout', pending: forceLogout.isPending, text: <>Revokes every active session of <b>{tenant.name}</b>.</>, run: () => void run('Forcing logout', () => forceLogout.mutateAsync(tenant.id)) },
    reset: { title: 'Reset owner password', destructive: true, slug: true, label: 'Reset password', pending: reset.isPending, text: <>Sends a password reset to the owner of <b>{tenant.name}</b>.</>, run: () => void run('Resetting owner password', () => reset.mutateAsync(tenant.id)) },
    impersonate: { title: 'Impersonate tenant', label: 'Open portal', pending: impersonate.isPending, text: <>Opens a 10-minute, non-renewable session inside <b>{tenant.name}</b> in a new tab. Audited.</>, run: () => void run('Creating impersonation session', () => impersonate.mutateAsync(tenant.id), (r) => {
      const res = r as { accessToken: string; expiresAt: string; portalUrl: string };
      const fragment = new URLSearchParams({ at: res.accessToken, rt: 'impersonation-not-renewable', exp: res.expiresAt }).toString();
      window.open(`${res.portalUrl}/onboarding-complete#${fragment}`, '_blank');
    }) },
  };

  const btn = (a: Action, label: string, Icon: typeof Wrench, danger = false) => (
    <Button key={a} type="button" size="sm" variant="outline" className={cn('h-auto min-h-9 justify-start whitespace-normal text-left', danger && 'text-red-700 hover:text-red-800 dark:text-red-300', action === a && 'border-ring')} disabled={off} title={canManage ? undefined : 'Requires tenants:manage'} aria-expanded={action === a} onClick={() => setAction(action === a ? null : a)}>
      <Icon className="size-4" aria-hidden />{label}
    </Button>
  );

  return (
    <section ref={rootRef} aria-label={`Control ${tenant.name}`} className="@container rounded-[14px] border bg-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Managing tenant</p>
          <h2 className="truncate text-lg font-semibold leading-tight">{tenant.name}</h2>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{tenant.slug}</span>
        {status ? <Chip tone={STATUS_TONE[status]}>{status}</Chip> : null}
        {sub ? <Chip tone="blue">{sub.plan.name}</Chip> : null}
        {owner ? <span className="min-w-0 truncate text-xs text-muted-foreground">Owner: {owner.email}</span> : null}
        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm"><Link href={`/tenants/${tenant.id}`}><ExternalLink className="size-4" aria-hidden />Open full page</Link></Button>
          <Button type="button" size="sm" variant="outline" onClick={onClose}><X className="size-4" aria-hidden />Close</Button>
        </div>
      </header>

      <div className="space-y-3 p-4">
        {isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Loading tenant details…</p> : null}
        {isError ? <p className="text-sm text-destructive">Could not load tenant details.</p> : null}
        {!canManage ? <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">Read-only: your role lacks the tenants:manage permission.</p> : null}

        <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-3">
          <Group id="grp-access" title="Status & access" flash={flash === 'access'}>
            <div className="grid grid-cols-1 gap-2 @md:grid-cols-2 @3xl:grid-cols-1 @6xl:grid-cols-2">
              {status === 'SUSPENDED' ? btn('reactivate', 'Reactivate', Power) : btn('suspend', 'Suspend', ShieldAlert, true)}
              {btn('maintenance', maint ? 'Maintenance off' : 'Maintenance on', Wrench)}
              {btn('logout', 'Force logout', LogOut, true)}
              {btn('reset', 'Reset owner password', KeyRound, true)}
              {btn('impersonate', 'Impersonate', UserCog)}
            </div>
            {action ? <InlineConfirm key={action} cfg={confirms[action]} slug={tenant.slug} reason={reason} setReason={setReason} onCancel={() => setAction(null)} /> : null}
          </Group>

          <Group id="grp-subscription" title="Subscription" flash={flash === 'subscription'}>
            <dl>
              <Fact k="Plan" v={sub?.plan.name ?? '—'} />
              <Fact k="Subscription" v={sub ? `${sub.status} · ${sub.billingCycle}` : '—'} />
              {status === 'TRIAL' || t?.trialEndsAt ? <Fact k="Trial ends" v={d10(t?.trialEndsAt)} /> : null}
              <Fact k="Period end" v={d10(sub?.currentPeriodEnd ?? t?.subscriptionExpiresAt)} />
            </dl>
            {status === 'TRIAL' ? (
              <div className="mt-3 space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">Extend trial (1–90 days)</p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" aria-label="Fewer days" onClick={() => setDays((d) => Math.max(1, d - 1))}><Minus className="size-4" /></Button>
                  <Input className="text-center font-mono" type="number" min={1} max={90} value={days} aria-label="Days to extend" onChange={(e) => setDays(Math.min(90, Math.max(1, Math.round(Number(e.target.value) || 1))))} />
                  <Button type="button" variant="outline" size="icon" aria-label="More days" onClick={() => setDays((d) => Math.min(90, d + 1))}><Plus className="size-4" /></Button>
                </div>
                <Input placeholder="Reason (optional)" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Extension reason" />
                <Button type="button" size="sm" disabled={off} title={canManage ? undefined : 'Requires tenants:manage'} onClick={() => void run('Extending trial', () => extend.mutateAsync({ tenantId: tenant.id, days, reason: reason.trim() || undefined }))}>
                  {extend.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CalendarPlus className="size-4" aria-hidden />}Extend {days} day{days === 1 ? '' : 's'}
                </Button>
              </div>
            ) : <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">Trial extension is available only for tenants in trial.</p>}
            <Button asChild variant="outline" size="sm" className="mt-3 w-full"><Link href={`/tenants/${tenant.id}`}>Change plan on tenant page</Link></Button>
          </Group>

          <Group id="grp-facts" title="Key facts" flash={false}>
            <dl>
              <Fact k="Maintenance" v={t ? (maint ? <Chip tone="amber">ON</Chip> : 'off') : '—'} />
              <Fact k="Created" v={d10(t?.createdAt)} />
              {t?.usage.map((u) => <Fact key={u.metric} k={u.metric.replace(/_/g, ' ')} v={String(u.value)} />)}
            </dl>
          </Group>
        </div>
      </div>
    </section>
  );
}
