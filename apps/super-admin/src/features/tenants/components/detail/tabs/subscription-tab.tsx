'use client';

/**
 * Subscription tab. Data: GET …/subscription (latest sub + plan), GET …/subscription/history (new), GET /admin/plans.
 * Ported from the old detail page: subscription facts, Change plan (manual "mark paid" / payment link + copy, check status,
 * resend by email) and trial extension. Dropped: nothing. NOTE: the API has no per-subscription "price override" or
 * proration data, so MRR is simply plan price normalised to a month.
 * No dialogs: every confirmation is an inline row inside the card.
 */
import * as React from 'react';
import { Copy, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Chip, EmptyNote, Panel, Segmented } from '@/features/dashboard/components/ui';
import { actionColor } from '@/features/dashboard/components/format';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { toBillingError, useChangePlan, useResendNotification, useVerifyPaymentStatus } from '@/features/billing/hooks/use-billing';
import type { ChangePlanMode, PaymentLinkResult, PaymentMode } from '@/features/billing/types';
import { usePlans } from '@/features/plans/hooks/use-plans';
import type { Plan } from '@/features/plans/types';
import { fileToDataUrl } from '@/lib/image-to-data-url';
import { useTenantSubscription, useTenantSubscriptionHistory, type TabSubscription } from '../../../api/tabs';
import { toTenantError, useExtendTrial } from '../../../hooks/use-tenants';
import { ErrorNote, TabSkeleton, TableScroll, fieldClass, fmtDate, fmtDateTime, money, statusLabel, statusTone, tdClass, thClass, type TabProps } from './_shared/kit';

const MODES: Array<{ value: PaymentMode; label: string }> = [
  { value: 'CASH', label: 'Cash' }, { value: 'BANK_TRANSFER', label: 'Bank transfer' }, { value: 'UPI', label: 'UPI' },
  { value: 'CHEQUE', label: 'Cheque' }, { value: 'CARD', label: 'Card' }, { value: 'OTHER', label: 'Other' },
];
const MAX_PROOF = 4 * 1024 * 1024;
const todayIso = () => new Date().toISOString().slice(0, 10);

const planPrice = (p: { priceMonthly: string; priceYearly: string }, cycle: string) => Number(cycle === 'YEARLY' ? p.priceYearly : p.priceMonthly);
const monthly = (p: { priceMonthly: string; priceYearly: string }, cycle: string) => (cycle === 'YEARLY' ? Number(p.priceYearly) / 12 : Number(p.priceMonthly));

const LIMIT_ROWS: Array<{ key: keyof Plan & keyof TabSubscription['plan']; label: string; unit?: string }> = [
  { key: 'maxMembers', label: 'Members' }, { key: 'maxStaff', label: 'Staff' }, { key: 'maxBranches', label: 'Branches' },
  { key: 'maxManagers', label: 'Managers' }, { key: 'maxTrainers', label: 'Trainers' }, { key: 'maxReceptionists', label: 'Receptionists' },
  { key: 'maxStorageMb', label: 'Storage', unit: 'MB' },
];

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-[13px] last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{children}</dd>
    </div>
  );
}

function CurrentCard({ sub }: { sub: TabSubscription }) {
  const mrr = sub.status === 'ACTIVE' ? monthly(sub.plan, sub.billingCycle) : null;
  return (
    <Panel title="Current subscription" index={0} right={<Chip tone={statusTone(sub.status)}>{statusLabel(sub.status)}</Chip>}>
      <dl>
        <Row k="Plan">{sub.plan.name}</Row>
        <Row k="Billing cycle">{statusLabel(sub.billingCycle)}</Row>
        <Row k="Price">{money(planPrice(sub.plan, sub.billingCycle), sub.plan.currency)} / {sub.billingCycle === 'YEARLY' ? 'year' : 'month'}</Row>
        <Row k="MRR">{mrr === null ? <span className="font-normal text-muted-foreground">— (not active)</span> : money(mrr, sub.plan.currency)}</Row>
        <Row k="Current period">{fmtDate(sub.currentPeriodStart)} → {fmtDate(sub.currentPeriodEnd)}</Row>
        {sub.trialEndsAt ? <Row k="Trial ends">{fmtDate(sub.trialEndsAt)}</Row> : null}
        {sub.graceEndsAt ? <Row k="Grace ends">{fmtDate(sub.graceEndsAt)}</Row> : null}
        <Row k="Cancels at period end">{sub.cancelAtPeriodEnd ? <Chip tone="amber">Yes</Chip> : 'No'}</Row>
        {sub.coupon ? <Row k="Coupon"><span className="font-mono">{sub.coupon.code}</span></Row> : null}
        {sub.gatewayProvider ? <Row k="Gateway">{statusLabel(sub.gatewayProvider)}</Row> : null}
        {sub.suspendedAt ? <Row k="Suspended">{fmtDate(sub.suspendedAt)}</Row> : null}
        {sub.cancelledAt ? <Row k="Cancelled">{fmtDate(sub.cancelledAt)}{sub.cancelReason ? ` · ${sub.cancelReason}` : ''}</Row> : null}
      </dl>
    </Panel>
  );
}

function ExtendTrial({ tenantId, sub, canEdit }: { tenantId: string; sub: TabSubscription; canEdit: boolean }) {
  const extend = useExtendTrial();
  const [days, setDays] = React.useState(7);
  const [reason, setReason] = React.useState('');
  const [confirming, setConfirming] = React.useState(false);
  const base = sub.trialEndsAt ? new Date(sub.trialEndsAt) : new Date();
  const next = new Date(Math.max(base.getTime(), Date.now()) + days * 86_400_000);
  return (
    <Panel title="Extend trial" hint="Trial only" index={1}>
      <p className="text-[13px] text-muted-foreground">Trial currently ends <b className="text-foreground">{fmtDate(sub.trialEndsAt)}</b>.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-md border" role="group" aria-label="Days to add">
          <Button size="icon" variant="ghost" className="size-9" aria-label="One day fewer" disabled={days <= 1 || !canEdit} onClick={() => setDays((d) => Math.max(1, d - 1))}><Minus /></Button>
          <span className="min-w-[4.5rem] text-center text-sm font-semibold tabular-nums" aria-live="polite">{days} day{days === 1 ? '' : 's'}</span>
          <Button size="icon" variant="ghost" className="size-9" aria-label="One day more" disabled={days >= 90 || !canEdit} onClick={() => setDays((d) => Math.min(90, d + 1))}><Plus /></Button>
        </div>
        {[7, 14, 30].map((d) => <Button key={d} size="sm" variant="outline" disabled={!canEdit} onClick={() => setDays(d)}>+{d}d</Button>)}
      </div>
      <div className="mt-3 space-y-1">
        <Label htmlFor="trial-reason">Reason (optional)</Label>
        <Input id="trial-reason" value={reason} maxLength={200} disabled={!canEdit} onChange={(e) => setReason(e.target.value)} placeholder="e.g. onboarding delayed" className="h-9" />
      </div>
      {!canEdit ? <p className="mt-3 text-xs text-muted-foreground">You need the tenants:manage permission to extend trials.</p> : confirming ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] dark:border-amber-500/30 dark:bg-amber-500/10">
          <span className="min-w-0 flex-1">Extend by <b>{days}</b> day{days === 1 ? '' : 's'}? New trial end ≈ <b>{fmtDate(next.toISOString())}</b>.</span>
          <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
          <Button
            size="sm"
            disabled={extend.isPending}
            onClick={() => extend.mutate({ tenantId, days, reason: reason.trim() || undefined }, {
              onSuccess: () => { toast.success(`Trial extended by ${days} day${days === 1 ? '' : 's'}.`); setConfirming(false); setReason(''); },
              onError: (e) => toast.error(toTenantError(e).message),
            })}
          >{extend.isPending ? 'Extending…' : 'Confirm extension'}</Button>
        </div>
      ) : <Button size="sm" className="mt-3" onClick={() => setConfirming(true)}>Extend trial…</Button>}
    </Panel>
  );
}

interface ManualForm { paymentMode: PaymentMode | ''; paymentDate: string; amount: string; notes: string; proofName: string; proofData: string }

function ChangePlan({ tenantId, tenantName, sub }: { tenantId: string; tenantName: string; sub: TabSubscription }) {
  const plans = usePlans();
  const change = useChangePlan(tenantId);
  const verify = useVerifyPaymentStatus(tenantId);
  const resend = useResendNotification(tenantId);
  const [targetId, setTargetId] = React.useState('');
  const [mode, setMode] = React.useState<ChangePlanMode>('manual');
  const [reviewing, setReviewing] = React.useState(false);
  const [form, setForm] = React.useState<ManualForm>({ paymentMode: '', paymentDate: todayIso(), amount: '', notes: '', proofName: '', proofData: '' });
  const [link, setLink] = React.useState<PaymentLinkResult | null>(null);
  const [reading, setReading] = React.useState(false);

  const options = (plans.data ?? []).filter((p) => p.isActive && p.id !== sub.plan.id);
  const target = options.find((p) => p.id === targetId) ?? null;
  const cycle = sub.billingCycle;
  const diff = target ? planPrice(target, cycle) - planPrice(sub.plan, cycle) : 0;

  const review = () => {
    if (!target) { toast.error('Pick a plan first.'); return; }
    setForm((f) => ({ ...f, amount: String(planPrice(target, cycle)) }));
    setReviewing(true);
  };
  const proof = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_PROOF) { toast.error('File is too large — max 4MB.'); return; }
    setReading(true);
    try { const d = await fileToDataUrl(file, 1280); setForm((f) => ({ ...f, proofName: file.name, proofData: d })); } catch { toast.error("Couldn't read that file."); } finally { setReading(false); }
  };
  const confirm = () => {
    if (!target) return;
    if (mode === 'manual') {
      if (!form.paymentMode) { toast.error('Pick a mode of payment.'); return; }
      if (!form.paymentDate) { toast.error('Pick a payment date.'); return; }
      change.mutate({ planId: target.id, mode: 'manual', manual: { paymentMode: form.paymentMode, paymentDate: form.paymentDate, amount: form.amount ? Number(form.amount) : undefined, proofDataUrl: form.proofData || undefined, notes: form.notes.trim() || undefined } }, {
        onSuccess: () => { toast.success(`${tenantName} marked paid and moved to ${target.name}.`); setReviewing(false); setTargetId(''); },
        onError: (e) => toast.error(toBillingError(e).message),
      });
    } else {
      change.mutate({ planId: target.id, mode: 'payment_link' }, {
        onSuccess: (r) => { setLink(r as PaymentLinkResult); setReviewing(false); toast.success('Payment link created — send it to the tenant.'); },
        onError: (e) => toast.error(toBillingError(e).message),
      });
    }
  };

  return (
    <Panel title="Change plan" index={2} className="lg:col-span-2" hint={`from ${sub.plan.name}`}>
      {plans.isLoading ? <p className="text-sm text-muted-foreground">Loading plans…</p> : plans.isError ? <ErrorNote what="plans" onRetry={() => void plans.refetch()} /> : (
        <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="target-plan">New plan</Label>
              <select id="target-plan" className={fieldClass} value={targetId} onChange={(e) => { setTargetId(e.target.value); setReviewing(false); setLink(null); }}>
                <option value="">Select a plan…</option>
                {options.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(planPrice(p, cycle), p.currency)}/{cycle === 'YEARLY' ? 'yr' : 'mo'}</option>)}
              </select>
              {target ? (
                <p className="text-xs text-muted-foreground">
                  {diff === 0 ? 'Same price as the current plan.' : <>This is <b className={diff > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}>{diff > 0 ? 'an upgrade' : 'a downgrade'} of {money(Math.abs(diff), target.currency)}</b> per {cycle === 'YEARLY' ? 'year' : 'month'}.</>}
                </p>
              ) : null}
            </div>
            <div>
              <Segmented label="Change mode" value={mode} onChange={(m) => { setMode(m); setReviewing(false); }} options={[{ value: 'manual', label: 'Mark paid manually' }, { value: 'payment_link', label: 'Send payment link' }]} />
              <p className="mt-2 text-xs text-muted-foreground">
                {mode === 'manual'
                  ? 'Records an offline payment (mode, date, optional proof) and switches the plan immediately. The tenant receives the usual activation and invoice emails.'
                  : 'Generates a real Razorpay link. The plan switches automatically once the tenant pays — nothing changes until then.'}
              </p>
            </div>
            {!reviewing && !link ? <Button size="sm" disabled={!target} onClick={review}>Review change…</Button> : null}

            {reviewing && target ? (
              <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                <p className="text-[13px]">Move <b>{tenantName}</b> from <b>{sub.plan.name}</b> to <b>{target.name}</b> ({mode === 'manual' ? 'marked paid manually' : 'via payment link'}).</p>
                {mode === 'manual' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="pm-mode">Mode of payment</Label>
                      <select id="pm-mode" className={fieldClass} value={form.paymentMode} onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value as PaymentMode }))}>
                        <option value="">Select…</option>
                        {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pm-amt">Amount</Label>
                      <Input id="pm-amt" type="number" min="0" step="0.01" className="h-9" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pm-date">Payment date</Label>
                      <Input id="pm-date" type="date" max={todayIso()} className="h-9" value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pm-proof">Proof (optional)</Label>
                      <input id="pm-proof" type="file" accept="image/*" disabled={reading} onChange={(e) => void proof(e.target.files?.[0])} className="block w-full text-xs file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1.5 file:text-xs" />
                      {form.proofName ? <p className="truncate text-xs text-muted-foreground">{form.proofName}</p> : null}
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="pm-notes">Notes (optional)</Label>
                      <Input id="pm-notes" className="h-9" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Reference number, reason…" />
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setReviewing(false)} disabled={change.isPending}>Cancel</Button>
                  <Button size="sm" onClick={confirm} disabled={change.isPending || reading}>{change.isPending ? 'Working…' : mode === 'manual' ? 'Confirm — mark paid' : 'Confirm — create link'}</Button>
                </div>
              </div>
            ) : null}

            {link ? (
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <p className="text-[13px] font-medium">Payment link ready</p>
                <div className="flex items-center gap-2">
                  <Input readOnly aria-label="Payment link" value={link.shortUrl} className="h-8 text-xs" />
                  <Button size="icon" variant="outline" className="size-8" aria-label="Copy link" onClick={() => { void navigator.clipboard.writeText(link.shortUrl); toast.success('Copied.'); }}><Copy /></Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Chip tone={statusTone(link.status)}>{statusLabel(link.status)}</Chip>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={resend.isPending || link.status !== 'PENDING'} onClick={() => resend.mutate({ paymentId: link.paymentId, medium: 'email' }, { onSuccess: () => toast.success('Notification resent.'), onError: (e) => toast.error(toBillingError(e).message) })}>Resend by email</Button>
                    <Button size="sm" disabled={verify.isPending || link.status !== 'PENDING'} onClick={() => verify.mutate(link.paymentId, {
                      onSuccess: (r) => { setLink((p) => (p ? { ...p, status: r.status } : p)); if (r.status === 'SUCCEEDED') toast.success('Payment confirmed — plan switched.'); if (r.status === 'FAILED') toast.error('Payment link expired or was cancelled.'); },
                      onError: (e) => toast.error(toBillingError(e).message),
                    })}>Check status</Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan limits{target ? ' — current vs new' : ''}</h3>
            <TableScroll label="Plan limits comparison">
              <table className="w-full min-w-[320px] border-collapse">
                <thead><tr><th className={thClass}>Limit</th><th className={`${thClass} text-right`}>{sub.plan.name}</th>{target ? <th className={`${thClass} text-right`}>{target.name}</th> : null}</tr></thead>
                <tbody>
                  {LIMIT_ROWS.map((r) => {
                    const cur = sub.plan[r.key] as number;
                    const nxt = target ? (target[r.key] as number) : null;
                    return (
                      <tr key={r.key}>
                        <td className={tdClass}>{r.label}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{cur.toLocaleString('en-IN')}{r.unit ? ` ${r.unit}` : ''}</td>
                        {nxt !== null ? (
                          <td className={`${tdClass} text-right tabular-nums font-semibold ${nxt < cur ? 'text-red-700 dark:text-red-400' : nxt > cur ? 'text-green-700 dark:text-green-400' : ''}`}>
                            {nxt.toLocaleString('en-IN')}{r.unit ? ` ${r.unit}` : ''}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
            <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              Limit and module overrides survive plan changes — manage them in the <b>Usage &amp; limits</b> and <b>Modules</b> tabs.
            </p>
          </div>
        </div>
      )}
    </Panel>
  );
}

function History({ tenantId }: { tenantId: string }) {
  const q = useTenantSubscriptionHistory(tenantId);
  return (
    <Panel title="Subscription history" index={3} className="lg:col-span-2" hint={q.data ? `${q.data.history.length} event${q.data.history.length === 1 ? '' : 's'}` : undefined}>
      {q.isLoading ? <TabSkeleton kpis={0} rows={3} /> : q.isError ? <ErrorNote what="subscription history" onRetry={() => void q.refetch()} /> : q.data ? (
        <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</h3>
            {q.data.history.length === 0 ? <EmptyNote>No plan or status changes recorded yet.</EmptyNote> : (
              <ol className="relative space-y-3 border-l pl-4">
                {q.data.history.map((h) => (
                  <li key={h.id} className="relative text-[13px]">
                    <i className="absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-card" style={{ background: actionColor(h.action) }} aria-hidden />
                    <p className="font-medium">
                      {statusLabel(h.action)}
                      {h.fromPlan || h.toPlan ? <span className="font-normal text-muted-foreground"> · {h.fromPlan ?? '—'} → {h.toPlan ?? '—'}</span> : null}
                    </p>
                    {h.fromStatus || h.toStatus ? <p className="text-xs text-muted-foreground">Status {h.fromStatus ? statusLabel(h.fromStatus) : '—'} → {h.toStatus ? statusLabel(h.toStatus) : '—'}</p> : null}
                    {h.note ? <p className="text-xs text-muted-foreground">{h.note}</p> : null}
                    <p className="text-xs text-muted-foreground">{fmtDateTime(h.at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subscription records</h3>
            <TableScroll label="Subscription records">
              <table className="w-full min-w-[420px] border-collapse">
                <thead><tr><th className={thClass}>Plan</th><th className={thClass}>Status</th><th className={thClass}>Cycle</th><th className={thClass}>Period</th></tr></thead>
                <tbody>
                  {q.data.subscriptions.map((s) => (
                    <tr key={s.id}>
                      <td className={`${tdClass} font-medium`}>{s.plan}</td>
                      <td className={tdClass}><Chip tone={statusTone(s.status)}>{statusLabel(s.status)}</Chip></td>
                      <td className={tdClass}>{statusLabel(s.billingCycle)}</td>
                      <td className={`${tdClass} whitespace-nowrap`}>{fmtDate(s.currentPeriodStart)} → {fmtDate(s.currentPeriodEnd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

export function SubscriptionTab({ tenantId, tenantName, canManage }: TabProps) {
  const q = useTenantSubscription(tenantId);
  const canBilling = useHasPermission('payments:manage') && canManage;
  if (q.isLoading) return <TabSkeleton kpis={0} rows={6} />;
  if (q.isError) return <ErrorNote what="the subscription" message={q.error?.message} onRetry={() => void q.refetch()} />;
  const sub = q.data;
  if (!sub) return <EmptyNote>This tenant has no subscription yet.</EmptyNote>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CurrentCard sub={sub} />
      {sub.status === 'TRIALING' ? <ExtendTrial tenantId={tenantId} sub={sub} canEdit={canManage} /> : (
        <Panel title="Billing period" index={1}>
          <p className="text-[13px] text-muted-foreground">
            {sub.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on <b className="text-foreground">{fmtDate(sub.currentPeriodEnd)}</b>. Trial extension is only available while the subscription is in trial.
          </p>
        </Panel>
      )}
      {canBilling ? <ChangePlan tenantId={tenantId} tenantName={tenantName} sub={sub} /> : (
        <Panel title="Change plan" index={2} className="lg:col-span-2"><p className="text-sm text-muted-foreground">You need the payments:manage and tenants:manage permissions to change this tenant&apos;s plan.</p></Panel>
      )}
      <History tenantId={tenantId} />
    </div>
  );
}
