'use client';

import * as React from 'react';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/features/dashboard/components/ui';
import { toBillingError, useChangePlan } from '@/features/billing/hooks/use-billing';
import type { ChangePlanMode, PaymentLinkResult, PaymentMode } from '@/features/billing/types';
import { fieldClass } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { fileToDataUrl } from '@/lib/image-to-data-url';
import { fmtPrice } from '../lib/plan-utils';
import type { Plan } from '../types';

const MODES: Array<{ value: PaymentMode; label: string }> = [
  { value: 'CASH', label: 'Cash' }, { value: 'BANK_TRANSFER', label: 'Bank transfer' }, { value: 'UPI', label: 'UPI' },
  { value: 'CHEQUE', label: 'Cheque' }, { value: 'CARD', label: 'Card' }, { value: 'OTHER', label: 'Other' },
];
const MAX_PROOF = 4 * 1024 * 1024;
const todayIso = () => new Date().toISOString().slice(0, 10);
const price = (p: Plan, cycle: string) => Number(cycle === 'YEARLY' ? p.priceYearly : p.priceMonthly);
const labelCls = 'mb-1 block text-xs font-medium text-muted-foreground';

/**
 * Inline replacement for the old modal change-plan dialog (deleted). Same useChangePlan hook/service as the tenant Subscription tab:
 * "manual" records an offline payment and switches immediately; "payment_link" creates a real Razorpay link and the plan switches once paid.
 */
export function ChangePlanInline({ tenant, cycle, currentPlan, plans, onClose }: { tenant: { id: string; name: string }; cycle: string; currentPlan: Plan; plans: Plan[]; onClose: () => void }) {
  const change = useChangePlan(tenant.id);
  const [targetId, setTargetId] = React.useState('');
  const [mode, setMode] = React.useState<ChangePlanMode>('manual');
  const [reviewing, setReviewing] = React.useState(false);
  const [reading, setReading] = React.useState(false);
  const [link, setLink] = React.useState<PaymentLinkResult | null>(null);
  const [form, setForm] = React.useState({ paymentMode: '' as PaymentMode | '', paymentDate: todayIso(), amount: '', notes: '', proofName: '', proofData: '' });
  const options = plans.filter((p) => p.isActive && p.id !== currentPlan.id);
  const target = options.find((p) => p.id === targetId) ?? null;
  const diff = target ? price(target, cycle) - price(currentPlan, cycle) : 0;
  const unit = cycle === 'YEARLY' ? 'yr' : 'mo';
  const idp = `cp-${tenant.id}`;

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
        onSuccess: () => { toast.success(`${tenant.name} marked paid and moved to ${target.name}.`); onClose(); },
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
    <div role="group" aria-label={`Change plan for ${tenant.name}`} className="space-y-3 rounded-lg border bg-muted/40 p-3.5">
      <p className="text-sm font-semibold">Change plan — {tenant.name} <span className="font-normal text-muted-foreground">(from {currentPlan.name}, {cycle.toLowerCase()} billing)</span></p>
      <div className="grid gap-3 md:grid-cols-2 [&>*]:min-w-0">
        <div>
          <label htmlFor={`${idp}-t`} className={labelCls}>New plan</label>
          <select id={`${idp}-t`} className={fieldClass} value={targetId} onChange={(e) => { setTargetId(e.target.value); setReviewing(false); setLink(null); }}>
            <option value="">Select a plan…</option>
            {options.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmtPrice(price(p, cycle), p.currency)}/{unit}</option>)}
          </select>
          {options.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">No other active plan to move to.</p> : null}
          {target ? <p className="mt-1 text-xs text-muted-foreground">{diff === 0 ? 'Same price as the current plan.' : <>This is <b>{diff > 0 ? 'an upgrade' : 'a downgrade'} of {fmtPrice(Math.abs(diff), target.currency)}</b> per {cycle === 'YEARLY' ? 'year' : 'month'}.</>}</p> : null}
        </div>
        <div>
          <Segmented label="Change mode" value={mode} onChange={(m) => { setMode(m); setReviewing(false); }} options={[{ value: 'manual', label: 'Mark paid manually' }, { value: 'payment_link', label: 'Send payment link' }]} />
          <p className="mt-2 text-xs text-muted-foreground">{mode === 'manual' ? 'Records an offline payment (mode, date, optional proof) and switches the plan immediately. The tenant receives the usual activation and invoice emails.' : 'Generates a real Razorpay link. The plan switches automatically once the tenant pays — nothing changes until then.'}</p>
        </div>
      </div>

      {!reviewing && !link ? (
        <div className="flex gap-2">
          <Button size="sm" disabled={!target} onClick={() => { if (target) { setForm((f) => ({ ...f, amount: String(price(target, cycle)) })); setReviewing(true); } }}>Review change…</Button>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      ) : null}

      {reviewing && target ? (
        <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-[13px]">Move <b>{tenant.name}</b> from <b>{currentPlan.name}</b> to <b>{target.name}</b> ({mode === 'manual' ? 'marked paid manually' : 'via payment link'}).</p>
          {mode === 'manual' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor={`${idp}-m`} className={labelCls}>Mode of payment</label>
                <select id={`${idp}-m`} className={fieldClass} value={form.paymentMode} onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value as PaymentMode }))}><option value="">Select…</option>{MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
              <div><label htmlFor={`${idp}-a`} className={labelCls}>Amount</label><Input id={`${idp}-a`} type="number" min="0" step="0.01" className="h-9" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
              <div><label htmlFor={`${idp}-d`} className={labelCls}>Payment date</label><Input id={`${idp}-d`} type="date" max={todayIso()} className="h-9" value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} /></div>
              <div><label htmlFor={`${idp}-p`} className={labelCls}>Proof (optional)</label><input id={`${idp}-p`} type="file" accept="image/*" disabled={reading} onChange={(e) => void proof(e.target.files?.[0])} className="block w-full text-xs file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1.5 file:text-xs" />{form.proofName ? <p className="truncate text-xs text-muted-foreground">{form.proofName}</p> : null}</div>
              <div className="sm:col-span-2"><label htmlFor={`${idp}-n`} className={labelCls}>Notes (optional)</label><Input id={`${idp}-n`} className="h-9" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Reference number, reason…" /></div>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setReviewing(false)} disabled={change.isPending}>Back</Button>
            <Button size="sm" onClick={confirm} disabled={change.isPending || reading}>{change.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}{mode === 'manual' ? 'Confirm — mark paid' : 'Confirm — create link'}</Button>
          </div>
        </div>
      ) : null}

      {link ? (
        <div className="space-y-2 rounded-lg border bg-card p-3">
          <p className="text-[13px] font-medium">Payment link ready — send it to the tenant.</p>
          <div className="flex items-center gap-2">
            <Input readOnly aria-label="Payment link" value={link.shortUrl} className="h-8 text-xs" />
            <Button size="icon" variant="outline" className="size-8" aria-label="Copy link" onClick={() => { void navigator.clipboard.writeText(link.shortUrl); toast.success('Copied.'); }}><Copy /></Button>
          </div>
          <Button size="sm" variant="outline" onClick={onClose}>Done</Button>
        </div>
      ) : null}
    </div>
  );
}
