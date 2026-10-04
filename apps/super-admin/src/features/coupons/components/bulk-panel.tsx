'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Copy, Download, Layers, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { downloadCsv } from '@/features/dashboard/components/export-csv';
import { InlineConfirm } from '@/features/tenants/components/detail/controls/confirm';
import { fieldClass } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { cn } from '@/lib/utils';
import { useBulkGenerateCoupons, type BulkGenerateInput } from '../api/insights';
import { toCouponError } from '../hooks/use-coupons';
import { CouponServiceError } from '../services/coupon.service';
import { Field, LimitInputs, ValueInputs, type LimitFields } from './coupon-fields';
import { endOfDayIso, optInt, todayYmd, toCsv, validateValue, valuePayload, type ValueFields } from './lib';

type F = ValueFields & LimitFields & { prefix: string; count: string; length: string };
const START: F = { prefix: '', count: '10', length: '6', type: 'PERCENTAGE', percentOff: '10', amountOff: '', currency: 'INR', trialDays: '14', scope: 'ONE_TIME', maxRedemptions: '1', perTenant: '1', expires: '' };
const CONFIRM_ABOVE = 50;

/** Inline bulk-generate panel: form -> (inline confirm when > 50) -> result block with copy / CSV. */
export function BulkGeneratePanel({ onClose }: { onClose: () => void }) {
  const reduce = useReducedMotion();
  const bulk = useBulkGenerateCoupons();
  const [f, setF] = useState<F>(START);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [armed, setArmed] = useState<BulkGenerateInput | null>(null);
  const [result, setResult] = useState<{ codes: string[]; desc: string } | null>(null);
  const patch = (p: Partial<F>) => { setF((s) => ({ ...s, ...p })); setErrors({}); setFormError(null); setArmed(null); };

  const run = (input: BulkGenerateInput) => {
    bulk.mutate(input, {
      onSuccess: (r) => { setArmed(null); setResult({ codes: r.codes, desc: `${input.type}${input.percentOff ? ` ${input.percentOff}%` : ''}` }); toast.success(`${r.created} coupons created`); },
      onError: (e) => { setArmed(null); const m = toCouponError(e).message; setFormError(m); if (e instanceof CouponServiceError) setErrors(e.fields); toast.error(m); },
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateValue(f);
    const prefix = f.prefix.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,12}$/.test(prefix)) errs.prefix = 'A–Z and 0–9, up to 12 characters.';
    const count = Number(f.count);
    if (!Number.isInteger(count) || count < 1 || count > 200) errs.count = '1–200.';
    const len = Number(f.length);
    if (!Number.isInteger(len) || len < 4 || len > 12) errs.length = '4–12.';
    const max = optInt(f.maxRedemptions); if (!max.ok) errs.maxRedemptions = 'Whole number, 1 or more.';
    const per = optInt(f.perTenant); if (!per.ok || per.value === undefined) errs.maxRedemptionsPerTenant = 'Whole number, 1 or more.';
    if (f.expires && f.expires < todayYmd()) errs.expiresAt = 'Must be today or later.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const input: BulkGenerateInput = {
      prefix, count, length: len, type: f.type, scope: f.scope, ...valuePayload(f), maxRedemptionsPerTenant: per.value!,
      ...(max.value ? { maxRedemptions: max.value } : {}), ...(f.expires ? { expiresAt: endOfDayIso(f.expires) } : {}),
    };
    if (count > CONFIRM_ABOVE) setArmed(input); else run(input);
  };

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(result!.codes.join('\n')); toast.success('Codes copied'); } catch { toast.error('Copy failed'); }
  };

  return (
    <motion.section aria-label="Bulk generate coupons" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }} className="rounded-[14px] border border-primary/40 bg-card">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Layers className="size-4" aria-hidden /></span>
        <h2 className="text-sm font-semibold">Bulk generate coupons</h2>
        <button type="button" onClick={onClose} aria-label="Close panel" className="ml-auto grid size-8 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" aria-hidden /></button>
      </header>
      {result ? (
        <div className="space-y-3 p-4">
          <p className="text-sm font-semibold" aria-live="polite">{result.codes.length} coupon{result.codes.length === 1 ? '' : 's'} created</p>
          <ul className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border bg-muted/40 p-2.5 font-mono text-[12.5px] sm:grid-cols-3 lg:grid-cols-5" aria-label="Generated codes">
            {result.codes.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void copyAll()}><Copy className="size-4" aria-hidden />Copy all</Button>
            <Button size="sm" variant="outline" onClick={() => downloadCsv(`coupons-${f.prefix.toUpperCase()}.csv`, toCsv([['Code', 'Type', 'Scope'], ...result.codes.map((c) => [c, f.type, f.scope])]))}><Download className="size-4" aria-hidden />Download CSV</Button>
            <Button size="sm" variant="outline" onClick={() => setResult(null)}>Generate more</Button>
            <Button size="sm" variant="ghost" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field id="bg-prefix" label="Prefix" error={errors.prefix} hint="e.g. LAUNCH → LAUNCHK7P2QX">
              <input id="bg-prefix" className={cn(fieldClass, 'font-mono uppercase')} maxLength={12} autoComplete="off" value={f.prefix} onChange={(e) => patch({ prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} aria-invalid={!!errors.prefix} />
            </Field>
            <Field id="bg-count" label="How many (1–200)" error={errors.count}>
              <input id="bg-count" type="number" min={1} max={200} className={fieldClass} value={f.count} onChange={(e) => patch({ count: e.target.value })} aria-invalid={!!errors.count} />
            </Field>
            <Field id="bg-len" label="Random suffix length (4–12)" error={errors.length}>
              <input id="bg-len" type="number" min={4} max={12} className={fieldClass} value={f.length} onChange={(e) => patch({ length: e.target.value })} aria-invalid={!!errors.length} />
            </Field>
            <ValueInputs idp="bg" v={f} errors={errors} onChange={(p) => patch(p)} />
            <LimitInputs idp="bg" v={f} errors={errors} onChange={(p) => patch(p)} minDate={todayYmd()} />
          </div>
          {armed ? (
            <InlineConfirm slug="" onCancel={() => setArmed(null)} cfg={{ title: `This creates ${armed.count} coupons`, text: 'Each gets a unique random code. They can be disabled or deleted individually afterwards.', label: `Create ${armed.count} coupons`, pending: bulk.isPending, run: () => run(armed) }} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={bulk.isPending}>{bulk.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}Generate coupons</Button>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              {formError ? <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">{formError}</p> : null}
            </div>
          )}
        </form>
      )}
    </motion.section>
  );
}
