'use client';

import { useId, useState } from 'react';
import { CalendarPlus, CheckCircle2, Loader2, LogOut, Minus, Plus, Power, Repeat, ShieldAlert, Wrench, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { usePlans } from '@/features/plans/hooks/use-plans';
import { cn } from '@/lib/utils';
import { useBulkAction, type BulkAction, type BulkParams, type BulkResult } from '../../api/list';
import { toTenantError } from '../../hooks/use-tenants';

/* Per-tenant results come straight from POST /admin/tenants/bulk. No overlay: everything expands inline under the bar. */
type Kind = 'extend' | 'plan' | 'maint-on' | 'maint-off' | 'suspend' | 'reactivate' | 'logout';
interface KindDef { label: string; icon: typeof Power; action: BulkAction; confirmWord: boolean; danger?: boolean }
const KINDS: Record<Kind, KindDef> = {
  extend: { label: 'Extend trial', icon: CalendarPlus, action: 'extend-trial', confirmWord: false },
  plan: { label: 'Change plan', icon: Repeat, action: 'change-plan', confirmWord: false },
  'maint-on': { label: 'Enable maintenance', icon: Wrench, action: 'maintenance', confirmWord: true },
  'maint-off': { label: 'Disable maintenance', icon: Wrench, action: 'maintenance', confirmWord: false },
  suspend: { label: 'Suspend', icon: Power, action: 'suspend', confirmWord: true, danger: true },
  reactivate: { label: 'Reactivate', icon: Power, action: 'reactivate', confirmWord: false },
  logout: { label: 'Force logout', icon: LogOut, action: 'force-logout', confirmWord: true, danger: true },
};
const BTN = 'inline-flex items-center gap-1.5 rounded-[7px] border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-100 outline-none transition-colors hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-teal-300 disabled:opacity-40';

export function BulkBar({ selected, onClear, onSucceeded }: { selected: Map<string, string>; onClear: () => void; onSucceeded: (ids: string[]) => void }) {
  const canManage = useHasPermission('tenants:manage');
  const canPay = useHasPermission('payments:manage');
  const plans = usePlans();
  const bulk = useBulkAction();
  const [kind, setKind] = useState<Kind | null>(null);
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState('');
  const [planId, setPlanId] = useState('');
  const [mode, setMode] = useState<'payment_link' | 'manual'>('payment_link');
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<{ label: string; data: BulkResult } | null>(null);
  const typedId = useId();
  const n = selected.size;

  if (!canManage || (n === 0 && !result)) return null;

  const def = kind ? KINDS[kind] : null;
  const needsWord = !!def && (def.confirmWord || (kind === 'plan' && mode === 'manual'));
  const armed = !needsWord || typed.trim() === 'CONFIRM';
  const ready = !!def && armed && (kind !== 'plan' || !!planId) && (kind !== 'extend' || (days >= 1 && days <= 90));

  const open = (k: Kind) => { setKind(k); setTyped(''); setReason(''); setMode('payment_link'); setResult(null); };
  const close = () => { setKind(null); setTyped(''); };
  const run = () => {
    if (!kind || !def) return;
    const params: BulkParams = {};
    if (kind === 'extend') params.days = days;
    if (kind === 'plan') { params.planId = planId; params.mode = mode; }
    if (kind === 'maint-on' || kind === 'maint-off') params.enabled = kind === 'maint-on';
    if (reason.trim() && (kind === 'extend' || kind === 'suspend' || kind === 'maint-on')) params.reason = reason.trim();
    const label = def.label;
    const ids = [...selected.keys()];
    const t = toast.loading(`${label} on ${ids.length} tenant${ids.length === 1 ? '' : 's'}…`);
    bulk.mutate({ action: def.action, tenantIds: ids, params }, {
      onSuccess: (data) => {
        setResult({ label, data });
        onSucceeded(data.results.filter((r) => r.ok).map((r) => r.tenantId));
        close();
        if (data.failed === 0) toast.success(`${label}: ${data.succeeded} succeeded`, { id: t });
        else toast.warning(`${label}: ${data.succeeded} succeeded, ${data.failed} failed`, { id: t });
      },
      onError: (e) => toast.error(toTenantError(e).message, { id: t }),
    });
  };

  const activePlans = (plans.data ?? []).filter((p) => p.isActive);
  const nameOf = (id: string) => selected.get(id) ?? id.slice(0, 8);
  const failures = result?.data.results.filter((r) => !r.ok) ?? [];

  return (
    <div className="sticky bottom-0 z-10 border-t bg-card shadow-[0_-8px_20px_-12px_rgba(15,23,42,0.35)]">
      {n > 0 ? (
        <div role="toolbar" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 bg-slate-900 px-3.5 py-2.5 text-[13px] text-slate-200">
          <b className="text-teal-300">{n} selected</b>
          {(['extend', ...(canPay ? ['plan'] : []), 'maint-on', 'maint-off', 'reactivate', 'suspend', 'logout'] as Kind[]).map((k) => {
            const d = KINDS[k];
            return (
              <button key={k} type="button" className={cn(BTN, d.danger && 'text-red-300', kind === k && 'ring-2 ring-teal-300')} aria-expanded={kind === k} onClick={() => (kind === k ? close() : open(k))}>
                <d.icon className="size-3.5" aria-hidden />{d.label}
              </button>
            );
          })}
          <button type="button" className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-slate-300 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-teal-300" onClick={() => { onClear(); close(); }}>
            <X className="size-3.5" aria-hidden />Clear selection
          </button>
        </div>
      ) : null}

      {def ? (
        <div role="group" aria-label={`${def.label} for ${n} tenants`} className={cn('space-y-3 px-4 py-3 text-sm', def.danger && 'bg-red-50 dark:bg-red-500/10')}>
          <p className="font-semibold">{def.label} — {n} tenant{n === 1 ? '' : 's'}</p>
          {kind === 'extend' ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Add days (TRIAL tenants only)</span>
              <div className="inline-flex items-center gap-1">
                <Button type="button" size="icon" variant="outline" className="size-8" aria-label="Fewer days" disabled={days <= 1} onClick={() => setDays((d) => Math.max(1, d - 1))}><Minus className="size-4" /></Button>
                <Input aria-label="Days" type="number" min={1} max={90} value={days} onChange={(e) => setDays(Math.max(1, Math.min(90, Number(e.target.value) || 1)))} className="h-8 w-16 text-center" />
                <Button type="button" size="icon" variant="outline" className="size-8" aria-label="More days" disabled={days >= 90} onClick={() => setDays((d) => Math.min(90, d + 1))}><Plus className="size-4" /></Button>
              </div>
            </div>
          ) : null}
          {kind === 'plan' ? (
            <div className="space-y-2.5">
              <select aria-label="New plan" value={planId} onChange={(e) => setPlanId(e.target.value)} className="h-9 w-full max-w-sm rounded-md border border-input bg-card px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Select a plan…</option>
                {activePlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div role="radiogroup" aria-label="Billing mode" className="grid gap-1.5">
                <div className="flex items-start gap-2"><input id="bm-link" type="radio" name="bulk-mode" className="mt-1" checked={mode === 'payment_link'} onChange={() => setMode('payment_link')} /><label htmlFor="bm-link">Send payment link (one Razorpay link per tenant, default)</label></div>
                <div className="flex items-start gap-2"><input id="bm-manual" type="radio" name="bulk-mode" className="mt-1" checked={mode === 'manual'} onChange={() => setMode('manual')} /><label htmlFor="bm-manual">Record as paid manually</label></div>
              </div>
              {mode === 'manual' ? (
                <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-100 p-2.5 text-[13px] text-red-900 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />Manual mode records a PAID payment (mode &quot;Other&quot;, dated today) and activates the plan for every selected tenant without collecting money. Use it only if payment was received offline.
                </p>
              ) : null}
            </div>
          ) : null}
          {(kind === 'extend' || kind === 'suspend' || kind === 'maint-on') ? <Input placeholder="Reason (optional)" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" className="max-w-lg" /> : null}
          {kind === 'reactivate' ? <p className="text-muted-foreground">Only SUSPENDED tenants can be reactivated; others are reported as failed.</p> : null}
          {kind === 'logout' ? <p className="text-muted-foreground">Signs out every staff and member session of the selected tenants.</p> : null}
          {needsWord ? (
            <div className="space-y-1">
              <label htmlFor={typedId} className="block text-xs text-muted-foreground">Type <code className="rounded bg-card px-1 font-mono text-foreground">CONFIRM</code> to apply to {n} tenant{n === 1 ? '' : 's'}</label>
              <Input id={typedId} className="max-w-[180px] font-mono" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={def.danger ? 'destructive' : 'default'} disabled={!ready || bulk.isPending} onClick={run}>
              {bulk.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}{def.label} ({n})
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={bulk.isPending} onClick={close}>Cancel</Button>
          </div>
        </div>
      ) : null}

      {result ? (
        <div role="status" className="space-y-2 border-t px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-semibold">{result.label}: </p>
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" aria-hidden />{result.data.succeeded} succeeded</span>
            <span className={cn('inline-flex items-center gap-1', result.data.failed ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground')}><XCircle className="size-4" aria-hidden />{result.data.failed} failed</span>
            <button type="button" className="ml-auto text-xs font-semibold text-primary underline" onClick={() => setResult(null)}>Dismiss</button>
          </div>
          {failures.length > 0 ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-muted/50 p-2.5 text-[13px]">
              {failures.map((f) => <li key={f.tenantId}><b>{nameOf(f.tenantId)}</b> — <span className="text-muted-foreground">{f.error ?? 'Failed'}</span></li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
