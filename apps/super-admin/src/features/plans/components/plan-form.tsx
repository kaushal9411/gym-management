'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fmtPct } from '@/features/dashboard/components/format';
import { Panel } from '@/features/dashboard/components/ui';
import { Switch } from '@/features/tenants/components/detail/controls/confirm';
import { usePriceImpact } from '../api/insights';
import { toPlanError, useCreatePlan, useSetPlanActive, useUpdatePlan } from '../hooks/use-plans';
import { slugify, useDebounced, yearlyDiscount } from '../lib/plan-utils';
import type { Plan, PlanFeature, UpsertPlanInput } from '../types';
import { ImpactView } from './impact-view';

/*
 * Replaces the old modal PlanFormDialog. Create/edit is an inline panel in normal page flow.
 * Not built (no API support): plan versioning / grandfathering of existing subscribers.
 * Limits have no "unlimited" value in the API validator: branches/managers/trainers/members/storage must be >= 1, receptionists/staff may be 0.
 */

const LIMITS = [
  { key: 'maxMembers', label: 'Max members', min: 1 },
  { key: 'maxStaff', label: 'Max staff', min: 0 },
  { key: 'maxBranches', label: 'Max branches', min: 1 },
  { key: 'maxManagers', label: 'Max managers', min: 1 },
  { key: 'maxTrainers', label: 'Max trainers', min: 1 },
  { key: 'maxReceptionists', label: 'Max receptionists', min: 0 },
  { key: 'maxStorageMb', label: 'Storage (MB)', min: 1 },
] as const;
type LimitKey = (typeof LIMITS)[number]['key'];

interface Draft {
  name: string; slug: string; description: string; sortOrder: string; isActive: boolean;
  priceMonthly: string; priceYearly: string; currency: string; trialDays: string;
  limits: Record<LimitKey, string>;
  features: PlanFeature[];
}
type Errors = Partial<Record<string, string>>;

const blank = (): Draft => ({
  name: '', slug: '', description: '', sortOrder: '0', isActive: true, priceMonthly: '0', priceYearly: '0', currency: 'INR', trialDays: '14',
  limits: { maxMembers: '200', maxStaff: '10', maxBranches: '1', maxManagers: '2', maxTrainers: '5', maxReceptionists: '2', maxStorageMb: '1024' },
  features: [],
});
const fromPlan = (p: Plan): Draft => ({
  name: p.name, slug: p.slug, description: p.description ?? '', sortOrder: String(p.sortOrder), isActive: p.isActive,
  priceMonthly: String(Number(p.priceMonthly)), priceYearly: String(Number(p.priceYearly)), currency: p.currency, trialDays: String(p.trialDays),
  limits: Object.fromEntries(LIMITS.map((l) => [l.key, String(p[l.key])])) as Record<LimitKey, string>,
  features: p.features.map((f) => ({ ...f })),
});
const keyFrom = (label: string) => slugify(label).replace(/-/g, '_').slice(0, 60);
const num = (v: string): number => (v.trim() === '' ? NaN : Number(v));

function validate(d: Draft, creating: boolean): Errors {
  const e: Errors = {};
  if (d.name.trim().length < 2 || d.name.trim().length > 80) e.name = 'Name must be 2–80 characters.';
  if (creating && !/^[a-z0-9-]{2,40}$/.test(d.slug)) e.slug = 'Slug: 2–40 lowercase letters, numbers or hyphens.';
  if (d.description.length > 500) e.description = 'Max 500 characters.';
  if (!(num(d.priceMonthly) >= 0)) e.priceMonthly = 'Enter a price of 0 or more.';
  if (!(num(d.priceYearly) >= 0)) e.priceYearly = 'Enter a price of 0 or more.';
  if (!/^[A-Za-z]{3}$/.test(d.currency)) e.currency = '3-letter code, e.g. INR.';
  const t = num(d.trialDays);
  if (!Number.isInteger(t) || t < 0 || t > 90) e.trialDays = 'Whole number 0–90.';
  const s = num(d.sortOrder);
  if (!Number.isInteger(s) || s < 0) e.sortOrder = 'Whole number, 0 or more.';
  for (const l of LIMITS) {
    const v = num(d.limits[l.key]);
    if (!Number.isInteger(v) || v < l.min) e[l.key] = `Whole number, ${l.min} or more.`;
  }
  d.features.forEach((f, i) => {
    if (!f.label.trim() || f.label.length > 120) e[`feature-${i}`] = 'Label required (max 120).';
    else if (!f.key.trim() || f.key.length > 60) e[`feature-${i}`] = 'Key required (max 60).';
  });
  return e;
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {error ? <p id={`${id}-err`} className="text-xs text-red-700 dark:text-red-400">{error}</p> : hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
const inp = 'h-9';
const sectionTitle = 'mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

export function PlanForm({ mode, onClose, onSaved }: { mode: 'create' | Plan; onClose: () => void; onSaved?: (plan: Plan) => void }) {
  const creating = mode === 'create';
  const plan = creating ? null : mode;
  const initial = React.useMemo(() => (plan ? fromPlan(plan) : blank()), [plan]);
  const [d, setD] = React.useState<Draft>(initial);
  const [slugTouched, setSlugTouched] = React.useState(!creating);
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState('');
  const [discarding, setDiscarding] = React.useState(false);
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const setActive = useSetPlanActive();
  const busy = create.isPending || update.isPending || setActive.isPending;
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const err = (k: string) => errors[k];

  const m = num(d.priceMonthly);
  const y = num(d.priceYearly);
  const discount = yearlyDiscount(m, y);

  // Debounced price-impact preview (edit only, only when a price actually changed).
  const dm = useDebounced(m);
  const dy = useDebounced(y);
  const mChanged = !!plan && Number.isFinite(dm) && dm >= 0 && dm !== Number(plan.priceMonthly);
  const yChanged = !!plan && Number.isFinite(dy) && dy >= 0 && dy !== Number(plan.priceYearly);
  const impact = usePriceImpact(plan?.id ?? '', { priceMonthly: mChanged ? dm : undefined, priceYearly: yChanged ? dy : undefined }, mChanged || yChanged);
  const priceDirty = !!plan && (m !== Number(plan.priceMonthly) || y !== Number(plan.priceYearly));

  const moveFeature = (i: number, dir: -1 | 1) => setD((p) => {
    const j = i + dir;
    if (j < 0 || j >= p.features.length) return p;
    const f = [...p.features];
    [f[i], f[j]] = [f[j]!, f[i]!];
    return { ...p, features: f };
  });
  const patchFeature = (i: number, patch: Partial<PlanFeature>) => setD((p) => ({ ...p, features: p.features.map((f, k) => (k === i ? { ...f, ...patch } : f)) }));

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError('');
    const e = validate(d, creating);
    setErrors(e);
    if (Object.keys(e).length > 0) { toast.error('Fix the highlighted fields.'); return; }
    const input: UpsertPlanInput = {
      slug: d.slug, name: d.name.trim(), description: d.description.trim() || undefined,
      priceMonthly: m, priceYearly: y, currency: d.currency.toUpperCase(), trialDays: num(d.trialDays), sortOrder: num(d.sortOrder),
      maxBranches: num(d.limits.maxBranches), maxManagers: num(d.limits.maxManagers), maxTrainers: num(d.limits.maxTrainers),
      maxReceptionists: num(d.limits.maxReceptionists), maxStaff: num(d.limits.maxStaff), maxMembers: num(d.limits.maxMembers), maxStorageMb: num(d.limits.maxStorageMb),
      features: d.features.map((f) => ({ key: f.key.trim(), label: f.label.trim(), included: f.included })),
    };
    try {
      let saved = creating ? await create.mutateAsync(input) : await update.mutateAsync({ id: plan!.id, input });
      // isActive isn't part of the create/update body — it has its own endpoint.
      if (d.isActive !== (plan?.isActive ?? true)) saved = await setActive.mutateAsync({ id: saved.id, isActive: d.isActive });
      toast.success(creating ? `Plan "${saved.name}" created` : 'Plan updated');
      onSaved?.(saved);
      onClose();
    } catch (x) {
      const msg = toPlanError(x).message;
      if (/slug/i.test(msg)) setErrors((p) => ({ ...p, slug: msg })); else setFormError(msg);
      toast.error(msg);
    }
  };

  const cancel = () => { if (dirty && !discarding) setDiscarding(true); else onClose(); };

  return (
    <Panel title={creating ? 'New plan' : `Edit ${plan!.name}`} hint={creating ? 'appears in the catalogue once saved' : `slug ${plan!.slug} is locked`} className="border-primary/40 ring-1 ring-primary/20">
      <form onSubmit={(ev) => void submit(ev)} noValidate className="space-y-5">
        <fieldset className="space-y-3" disabled={busy}>
          <legend className={sectionTitle}>Basics</legend>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field id="pf-name" label="Name" error={err('name')}>
              <Input id="pf-name" className={inp} value={d.name} aria-invalid={!!err('name')} onChange={(e) => { const name = e.target.value; setD((p) => ({ ...p, name, slug: slugTouched ? p.slug : slugify(name) })); }} />
            </Field>
            <Field id="pf-slug" label="Slug" hint={creating ? 'Auto-filled from the name' : 'Cannot be changed'} error={err('slug')}>
              <Input id="pf-slug" className={`${inp} font-mono`} value={d.slug} disabled={!creating} aria-invalid={!!err('slug')} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value.toLowerCase()); }} />
            </Field>
            <Field id="pf-sort" label="Sort order" hint="Lower shows first" error={err('sortOrder')}>
              <Input id="pf-sort" type="number" min={0} className={inp} value={d.sortOrder} aria-invalid={!!err('sortOrder')} onChange={(e) => set('sortOrder', e.target.value)} />
            </Field>
            <div className="flex items-end gap-2 pb-1.5">
              <Switch checked={d.isActive} onChange={(v) => set('isActive', v)} label="Plan is active" />
              <span className="text-sm">{d.isActive ? 'Active — can be chosen' : 'Inactive — hidden'}</span>
            </div>
          </div>
          <Field id="pf-desc" label="Description" error={err('description')}>
            <Input id="pf-desc" className={inp} value={d.description} maxLength={500} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </fieldset>

        <fieldset className="space-y-3" disabled={busy}>
          <legend className={sectionTitle}>Pricing</legend>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Field id="pf-pm" label="Price / month" error={err('priceMonthly')}><Input id="pf-pm" type="number" min={0} step="0.01" className={inp} value={d.priceMonthly} aria-invalid={!!err('priceMonthly')} onChange={(e) => set('priceMonthly', e.target.value)} /></Field>
            <Field id="pf-py" label="Price / year" error={err('priceYearly')}><Input id="pf-py" type="number" min={0} step="0.01" className={inp} value={d.priceYearly} aria-invalid={!!err('priceYearly')} onChange={(e) => set('priceYearly', e.target.value)} /></Field>
            <Field id="pf-cur" label="Currency" error={err('currency')}><Input id="pf-cur" maxLength={3} className={`${inp} uppercase`} value={d.currency} aria-invalid={!!err('currency')} onChange={(e) => set('currency', e.target.value.toUpperCase())} /></Field>
            <Field id="pf-trial" label="Trial days" hint="0–90" error={err('trialDays')}><Input id="pf-trial" type="number" min={0} max={90} className={inp} value={d.trialDays} aria-invalid={!!err('trialDays')} onChange={(e) => set('trialDays', e.target.value)} /></Field>
            <div className="flex items-end pb-1.5 text-sm" aria-live="polite">
              {discount === null ? <span className="text-muted-foreground">Yearly saving: —</span>
                : <span>Yearly saving <b className={discount < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}>{fmtPct(discount)}</b><span className="text-muted-foreground"> vs 12 × monthly</span></span>}
            </div>
          </div>
          {plan && priceDirty ? (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="mb-2 text-sm font-semibold">Price impact preview <span className="font-normal text-muted-foreground">(read-only — nothing changes until you save)</span></p>
              <ImpactView data={impact.data} loading={impact.isFetching} error={impact.isError ? toPlanError(impact.error).message : undefined} currency={plan.currency} />
            </div>
          ) : null}
        </fieldset>

        <fieldset className="space-y-3" disabled={busy}>
          <legend className={sectionTitle}>Limits</legend>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {LIMITS.map((l) => (
              <Field key={l.key} id={`pf-${l.key}`} label={l.label} hint={l.min === 0 ? '0 allowed' : 'At least 1'} error={err(l.key)}>
                <Input id={`pf-${l.key}`} type="number" min={l.min} className={inp} value={d.limits[l.key]} aria-invalid={!!err(l.key)} onChange={(e) => setD((p) => ({ ...p, limits: { ...p.limits, [l.key]: e.target.value } }))} />
              </Field>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2" disabled={busy}>
          <legend className={sectionTitle}>Features <span className="font-normal normal-case">({d.features.length})</span></legend>
          {d.features.length === 0 ? <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">No features yet — add the bullet points shown on the plan card.</p> : null}
          <ul className="space-y-2">
            {d.features.map((f, i) => (
              <li key={i} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2 sm:flex-nowrap">
                  <input type="checkbox" checked={f.included} onChange={(e) => patchFeature(i, { included: e.target.checked })} aria-label={`Feature ${i + 1} included`} className="size-4 shrink-0 accent-[var(--chart-1)]" />
                  <Input aria-label={`Feature ${i + 1} label`} placeholder="Label, e.g. Mobile app" className={`${inp} min-w-0 flex-1`} value={f.label} onChange={(e) => { const label = e.target.value; patchFeature(i, { label, key: f.key === keyFrom(f.label) ? keyFrom(label) : f.key }); }} />
                  <Input aria-label={`Feature ${i + 1} key`} placeholder="key" className={`${inp} w-36 shrink-0 font-mono text-xs`} value={f.key} onChange={(e) => patchFeature(i, { key: e.target.value })} />
                  <Button type="button" size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => moveFeature(i, -1)}><ArrowUp className="size-4" /></Button>
                  <Button type="button" size="sm" variant="ghost" aria-label="Move down" disabled={i === d.features.length - 1} onClick={() => moveFeature(i, 1)}><ArrowDown className="size-4" /></Button>
                  <Button type="button" size="sm" variant="ghost" aria-label="Remove feature" onClick={() => setD((p) => ({ ...p, features: p.features.filter((_, k) => k !== i) }))}><Trash2 className="size-4" /></Button>
                </div>
                {err(`feature-${i}`) ? <p className="text-xs text-red-700 dark:text-red-400">{err(`feature-${i}`)}</p> : null}
              </li>
            ))}
          </ul>
          <Button type="button" size="sm" variant="outline" onClick={() => setD((p) => ({ ...p, features: [...p.features, { key: '', label: '', included: true }] }))}><Plus className="size-4" aria-hidden />Add feature</Button>
        </fieldset>

        {formError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{formError}</p> : null}

        {discarding ? (
          <div role="group" aria-label="Discard changes" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
            <span className="mr-auto font-medium">Discard your unsaved changes?</span>
            <Button type="button" size="sm" variant="destructive" onClick={onClose}>Discard</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setDiscarding(false)}>Keep editing</Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy || (!creating && !dirty)}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}{creating ? 'Create plan' : 'Save changes'}</Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={cancel}>Cancel</Button>
            {dirty ? <span className="self-center text-xs text-muted-foreground">Unsaved changes</span> : null}
          </div>
        )}
      </form>
    </Panel>
  );
}
