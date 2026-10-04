'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Copy, KeyRound, Loader2, LogOut, Minus, Plus, ShieldAlert, Power, Trash2, Wrench } from 'lucide-react';
import { toast } from 'sonner';

import { notifyProgrammaticNavigation } from '@/components/navigation-progress-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toBillingError, useChangePlan } from '@/features/billing/hooks/use-billing';
import type { PaymentLinkResult, PaymentMode } from '@/features/billing/types';
import { Chip, type ChipTone } from '@/features/dashboard/components/ui';
import { usePlans } from '@/features/plans/hooks/use-plans';
import { useAfterTenantAction, type TenantOverview } from '@/features/tenants/api/detail';
import {
  toTenantError, useActivateTenant, useDeleteTenant, useExtendTrial, useForceLogout, useReactivateTenant, useResetOwnerPassword, useSetMaintenance, useSuspendTenant,
} from '@/features/tenants/hooks/use-tenants';
import type { TenantStatus } from '@/features/tenants/types';
import { cn } from '@/lib/utils';
import { InlineConfirm, READONLY_TIP, Switch, type ConfirmCfg } from './confirm';
import { LimitsEditor } from './limits-editor';
import { ModulesEditor } from './modules-editor';
import { NotesTags } from './notes-tags';

export const STATUS_TONE: Record<TenantStatus, ChipTone> = { ACTIVE: 'green', TRIAL: 'amber', PAST_DUE: 'red', SUSPENDED: 'red', CANCELLED: 'slate' };

function Section({ title, hint, children, danger }: { title: string; hint?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section aria-label={title} className="space-y-2.5 border-b pb-4 last:border-0 last:pb-0">
      <h3 className={cn('flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-[0.07em]', danger ? 'text-destructive' : 'text-muted-foreground')}>{title}{hint ? <span className="font-normal normal-case tracking-normal">{hint}</span> : null}</h3>
      {children}
    </section>
  );
}

const field = 'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
const MODES: Array<{ value: PaymentMode; label: string }> = [
  { value: 'CASH', label: 'Cash' }, { value: 'BANK_TRANSFER', label: 'Bank transfer' }, { value: 'UPI', label: 'UPI' }, { value: 'CHEQUE', label: 'Cheque' }, { value: 'CARD', label: 'Card' }, { value: 'OTHER', label: 'Other' },
];

type AccessAction = 'suspend' | 'activate' | 'reactivate' | 'maintenance' | 'logout' | 'reset';

/** Right-column control panel: access, subscription, limits, modules, notes/tags, danger zone. Every action is audited server-side. */
export function ControlPanel({ tenant, canManage }: { tenant: TenantOverview['tenant']; canManage: boolean }) {
  const router = useRouter();
  const after = useAfterTenantAction(tenant.id);
  const [action, setAction] = useState<AccessAction | null>(null);
  const [days, setDays] = useState(7);
  const [extReason, setExtReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const suspend = useSuspendTenant();
  const activate = useActivateTenant();
  const reactivate = useReactivateTenant();
  const maintenance = useSetMaintenance();
  const forceLogout = useForceLogout();
  const reset = useResetOwnerPassword();
  const extend = useExtendTrial();
  const remove = useDeleteTenant();

  // plan change
  const plans = usePlans();
  const changePlan = useChangePlan(tenant.id);
  const [planId, setPlanId] = useState('');
  const [planStep, setPlanStep] = useState<'pick' | 'manual'>('pick');
  const [manual, setManual] = useState<{ mode: PaymentMode | ''; date: string; amount: string; notes: string }>({ mode: '', date: new Date().toISOString().slice(0, 10), amount: '', notes: '' });
  const [link, setLink] = useState<PaymentLinkResult | null>(null);

  const busy = suspend.isPending || activate.isPending || reactivate.isPending || maintenance.isPending || forceLogout.isPending || reset.isPending;
  const off = !canManage || busy;
  const tip = canManage ? undefined : READONLY_TIP;
  const maint = tenant.maintenanceMode;
  const status = tenant.status;

  const run = async (label: string, fn: () => Promise<unknown>, okMsg?: (r: unknown) => string) => {
    const id = toast.loading(`${label}…`);
    try {
      const r = await fn();
      toast.success(okMsg ? okMsg(r) : `${label} — done`, { id });
      setAction(null);
      after();
    } catch (e) { toast.error(toTenantError(e).message, { id }); }
  };

  const confirms: Record<AccessAction, ConfirmCfg> = {
    suspend: { title: 'Suspend tenant', destructive: true, slug: true, label: 'Suspend', pending: suspend.isPending, text: <>Blocks staff and members of <b>{tenant.name}</b> from signing in until reactivated.</>, run: () => void run('Suspending tenant', () => suspend.mutateAsync(tenant.id)) },
    activate: { title: 'Activate tenant', label: 'Activate', pending: activate.isPending, text: <>Mark <b>{tenant.name}</b> as active.</>, run: () => void run('Activating tenant', () => activate.mutateAsync(tenant.id)) },
    reactivate: { title: 'Reactivate tenant', label: 'Reactivate', pending: reactivate.isPending, text: <>Restore access for <b>{tenant.name}</b>.</>, run: () => void run('Reactivating tenant', () => reactivate.mutateAsync(tenant.id)) },
    maintenance: { title: maint ? 'Disable maintenance mode' : 'Enable maintenance mode', slug: !maint, reason: true, label: maint ? 'Disable' : 'Enable', pending: maintenance.isPending, text: maint ? <>Bring <b>{tenant.name}</b> back online.</> : <>Users of <b>{tenant.name}</b> will see a maintenance screen.</>, run: (reason) => void run('Updating maintenance mode', () => maintenance.mutateAsync({ tenantId: tenant.id, enabled: !maint, reason: reason || undefined })) },
    logout: { title: 'Force logout', destructive: true, slug: true, label: 'Force logout', pending: forceLogout.isPending, text: <>Revokes every active session of <b>{tenant.name}</b>.</>, run: () => void run('Forcing logout', () => forceLogout.mutateAsync(tenant.id)) },
    reset: { title: 'Reset owner password', destructive: true, slug: true, label: 'Reset password', pending: reset.isPending, text: <>Sends a password reset email to the owner of <b>{tenant.name}</b>.</>, run: () => void run('Resetting owner password', () => reset.mutateAsync(tenant.id), (r) => `Password reset email sent to ${(r as { email: string }).email}`) },
  };

  const btn = (a: AccessAction, label: string, Icon: typeof Wrench, danger = false) => (
    <Button key={a} type="button" size="sm" variant="outline" className={cn('justify-start', danger && 'text-red-700 hover:text-red-800 dark:text-red-300', action === a && 'border-ring')} disabled={off} title={tip} aria-expanded={action === a} onClick={() => setAction(action === a ? null : a)}>
      <Icon className="size-4" aria-hidden />{label}
    </Button>
  );

  const otherPlans = (plans.data ?? []).filter((p) => p.isActive && p.name !== tenant.plan);
  const target = otherPlans.find((p) => p.id === planId);
  const planDone = () => { setPlanId(''); setPlanStep('pick'); };
  const applyManual = async () => {
    if (!manual.mode) { toast.error('Pick a mode of payment.'); return; }
    const id = toast.loading('Switching plan…');
    try {
      await changePlan.mutateAsync({ planId, mode: 'manual', manual: { paymentMode: manual.mode, paymentDate: manual.date, amount: manual.amount ? Number(manual.amount) : undefined, notes: manual.notes.trim() || undefined } });
      toast.success(`${tenant.name} marked paid and moved to ${target?.name ?? 'the new plan'}`, { id });
      planDone(); after();
    } catch (e) { toast.error(toBillingError(e).message, { id }); }
  };
  const sendLink = async () => {
    const id = toast.loading('Creating payment link…');
    try {
      const r = await changePlan.mutateAsync({ planId, mode: 'payment_link' });
      setLink(r as PaymentLinkResult);
      toast.success('Payment link created — send it to the tenant', { id });
    } catch (e) { toast.error(toBillingError(e).message, { id }); }
  };

  const deleteCfg: ConfirmCfg = {
    title: 'Delete tenant', destructive: true, slug: true, label: 'Delete tenant', pending: remove.isPending,
    text: <>Soft-deletes <b>{tenant.name}</b>: it disappears from the platform and nobody can sign in. This cannot be undone from the UI.</>,
    run: () => void (async () => {
      const id = toast.loading('Deleting tenant…');
      try { await remove.mutateAsync(tenant.id); toast.success('Tenant deleted', { id }); notifyProgrammaticNavigation('/tenants'); router.push('/tenants'); } catch (e) { toast.error(toTenantError(e).message, { id }); }
    })(),
  };

  return (
    <div className="space-y-4">
      <section aria-label="Control panel" className="rounded-[14px] border bg-card">
        <header className="flex items-baseline gap-2 px-4 pt-3.5"><h2 className="text-sm font-semibold">Control panel</h2><span className="ml-auto text-xs text-muted-foreground">every action is audited</span></header>
        <div className="space-y-4 px-4 pb-4 pt-3">
          {!canManage ? <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">Read-only: your role lacks the tenants:manage permission.</p> : null}

          <Section title="Access">
            <div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Status</span><Chip tone={STATUS_TONE[status]}>{status.replace('_', ' ')}</Chip></div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {status === 'SUSPENDED' ? btn('reactivate', 'Reactivate', Power) : btn('suspend', 'Suspend', ShieldAlert, true)}
              {status === 'CANCELLED' || status === 'PAST_DUE' ? btn('activate', 'Activate', Power) : null}
              {btn('logout', 'Force logout all users', LogOut, true)}
              {btn('reset', 'Reset owner password', KeyRound, true)}
            </div>
            <div className="flex items-center gap-2.5 py-1 text-[13px]">
              <Switch checked={maint} onChange={() => setAction(action === 'maintenance' ? null : 'maintenance')} disabled={off} label="Maintenance mode" title={tip} />
              Maintenance mode <Chip tone={maint ? 'amber' : 'slate'}>{maint ? 'on' : 'off'}</Chip>
            </div>
            {action ? <InlineConfirm key={action} cfg={confirms[action]} slug={tenant.slug} onCancel={() => setAction(null)} /> : null}
          </Section>

          <Section title="Subscription" hint={tenant.plan ? `current: ${tenant.plan}` : 'no plan'}>
            <div className="flex gap-2">
              <select aria-label="New plan" className={field} value={planId} disabled={!canManage || changePlan.isPending} title={tip} onChange={(e) => { setPlanId(e.target.value); setPlanStep('pick'); setLink(null); }}>
                <option value="">Change plan…</option>
                {otherPlans.map((p) => <option key={p.id} value={p.id}>{p.name} — ₹{Number(p.priceMonthly).toLocaleString('en-IN')}/mo</option>)}
              </select>
            </div>
            {planId && !link && planStep === 'pick' ? (
              <div className="space-y-2 rounded-lg border bg-muted/50 p-3 text-sm">
                <p className="text-muted-foreground">Apply <b className="text-foreground">{target?.name}</b> to <b className="text-foreground">{tenant.name}</b>: record an offline payment now, or send a payment link (plan switches once paid).</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={changePlan.isPending} onClick={() => { setManual((m) => ({ ...m, amount: target ? String(target.priceMonthly) : '' })); setPlanStep('manual'); }}>Mark paid manually</Button>
                  <Button type="button" size="sm" disabled={changePlan.isPending} onClick={() => void sendLink()}>{changePlan.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}Send payment link</Button>
                  <Button type="button" size="sm" variant="outline" onClick={planDone}>Cancel</Button>
                </div>
              </div>
            ) : null}
            {planId && planStep === 'manual' ? (
              <div role="group" aria-label="Mark paid manually" className="space-y-2 rounded-lg border bg-muted/50 p-3 text-sm">
                <p className="font-semibold">Mark paid manually</p>
                <select aria-label="Mode of payment" className={field} value={manual.mode} onChange={(e) => setManual((m) => ({ ...m, mode: e.target.value as PaymentMode }))}>
                  <option value="">Mode of payment…</option>
                  {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" min="0" step="0.01" aria-label="Amount" placeholder="Amount" value={manual.amount} onChange={(e) => setManual((m) => ({ ...m, amount: e.target.value }))} />
                  <Input type="date" aria-label="Payment date" max={new Date().toISOString().slice(0, 10)} value={manual.date} onChange={(e) => setManual((m) => ({ ...m, date: e.target.value }))} />
                </div>
                <Input aria-label="Notes" placeholder="Reference / notes (optional)" value={manual.notes} onChange={(e) => setManual((m) => ({ ...m, notes: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Proof upload lives in the Subscription tab.</p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" disabled={changePlan.isPending} onClick={() => void applyManual()}>{changePlan.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}Mark as paid &amp; apply</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPlanStep('pick')}>Back</Button>
                </div>
              </div>
            ) : null}
            {link ? (
              <div className="space-y-2 rounded-lg border bg-muted/50 p-3 text-sm">
                <p className="text-muted-foreground">Send this link to the tenant — the plan switches automatically once paid.</p>
                <div className="flex gap-2">
                  <Input readOnly value={link.shortUrl} aria-label="Payment link" className="h-8 text-xs" />
                  <Button type="button" size="sm" variant="outline" aria-label="Copy link" onClick={() => { void navigator.clipboard.writeText(link.shortUrl); toast.success('Copied'); }}><Copy className="size-3.5" aria-hidden /></Button>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => { setLink(null); planDone(); after(); }}>Done</Button>
              </div>
            ) : null}

            {status === 'TRIAL' ? (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">Extend trial (1–90 days)</p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" aria-label="Fewer days" disabled={off} onClick={() => setDays((d) => Math.max(1, d - 1))}><Minus className="size-4" /></Button>
                  <Input className="w-20 text-center font-mono" type="number" min={1} max={90} value={days} aria-label="Days to extend" disabled={off} onChange={(e) => setDays(Math.min(90, Math.max(1, Math.round(Number(e.target.value) || 1))))} />
                  <Button type="button" variant="outline" size="icon" aria-label="More days" disabled={off} onClick={() => setDays((d) => Math.min(90, d + 1))}><Plus className="size-4" /></Button>
                  <span className="text-xs text-muted-foreground">days</span>
                </div>
                <Input placeholder="Reason (optional)" maxLength={200} value={extReason} onChange={(e) => setExtReason(e.target.value)} aria-label="Extension reason" disabled={off} />
                <Button type="button" size="sm" disabled={off || extend.isPending} title={tip} onClick={() => void run('Extending trial', () => extend.mutateAsync({ tenantId: tenant.id, days, reason: extReason.trim() || undefined }))}>
                  {extend.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CalendarPlus className="size-4" aria-hidden />}Extend {days} day{days === 1 ? '' : 's'}
                </Button>
              </div>
            ) : <p className="text-xs text-muted-foreground">Trial extension is available only while a tenant is in trial.</p>}
          </Section>

          <Section title="Limit overrides"><LimitsEditor tenantId={tenant.id} canManage={canManage} /></Section>
          <Section title="Modules"><ModulesEditor tenantId={tenant.id} canManage={canManage} layout="compact" /></Section>
          <Section title="Internal notes & tags"><NotesTags tenantId={tenant.id} canManage={canManage} /></Section>
        </div>
      </section>

      {/* Cancel-subscription is intentionally absent: no admin endpoint cancels a subscription (only plan change / suspend / delete exist). */}
      <section aria-label="Danger zone" className="rounded-[14px] border border-red-200 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/5">
        <header className="px-4 pt-3.5"><h2 className="text-sm font-semibold text-destructive">Danger zone</h2></header>
        <div className="space-y-3 px-4 pb-4 pt-3 text-sm">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1"><p className="font-semibold">Delete tenant</p><p className="text-xs text-muted-foreground">Soft delete · type the slug to confirm</p></div>
            <Button type="button" size="sm" variant="outline" className="border-red-300 text-red-700 dark:text-red-300" disabled={!canManage} title={tip} aria-expanded={deleting} onClick={() => setDeleting((v) => !v)}><Trash2 className="size-4" aria-hidden />Delete</Button>
          </div>
          {deleting ? <InlineConfirm cfg={deleteCfg} slug={tenant.slug} onCancel={() => setDeleting(false)} /> : null}
        </div>
      </section>
    </div>
  );
}
