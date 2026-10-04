'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Dices, Loader2, TicketPlus, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Switch } from '@/features/tenants/components/detail/controls/confirm';
import { fieldClass } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { cn } from '@/lib/utils';
import { toCouponError, useCoupons, useCreateCoupon } from '../hooks/use-coupons';
import { CouponServiceError } from '../services/coupon.service';
import { useUpdateCoupon } from '../api/insights';
import type { Coupon, UpsertCouponInput } from '../types';
import { Field, LimitInputs, ValueInputs, describeCoupon, type LimitFields } from './coupon-fields';
import { endOfDayIso, optInt, randomCode, toYmd, todayYmd, validateValue, valuePayload, type ValueFields } from './lib';

type FormState = ValueFields & LimitFields & { code: string; isActive: boolean };

function initial(c?: Coupon): FormState {
  if (!c) return { code: '', type: 'PERCENTAGE', percentOff: '10', amountOff: '', currency: 'INR', trialDays: '14', scope: 'ONE_TIME', maxRedemptions: '', perTenant: '1', expires: '', isActive: true };
  return {
    code: c.code, type: c.type, percentOff: c.percentOff ? String(Number(c.percentOff)) : '', amountOff: c.amountOff ? String(Number(c.amountOff)) : '',
    currency: c.currency ?? 'INR', trialDays: c.trialExtensionDays ? String(c.trialExtensionDays) : '', scope: c.scope,
    maxRedemptions: c.maxRedemptions ? String(c.maxRedemptions) : '', perTenant: String(c.maxRedemptionsPerTenant), expires: toYmd(c.expiresAt), isActive: c.isActive,
  };
}

/** Map an API 422 message onto the field it names (the client only keeps the message string). */
function fieldFromMessage(msg: string): string | null {
  const m = msg.toLowerCase();
  for (const f of ['percentOff', 'amountOff', 'currency', 'trialExtensionDays', 'maxRedemptionsPerTenant', 'maxRedemptions', 'expiresAt', 'code']) {
    if (m.includes(f.toLowerCase())) return f;
  }
  return null;
}

/** Inline create / edit panel (no dialog). Shared by /coupons and /coupons/[id]. */
export function CouponFormPanel({ coupon, redeemed = 0, onClose, onSaved }: { coupon?: Coupon; redeemed?: number; onClose: () => void; onSaved?: (c: Coupon) => void }) {
  const edit = !!coupon;
  const reduce = useReducedMotion();
  const create = useCreateCoupon();
  const update = useUpdateCoupon();
  const [f, setF] = useState<FormState>(() => initial(coupon));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const existing = useCoupons().data;
  const codeRef = useRef<HTMLInputElement>(null);
  const idp = edit ? 'cf-edit' : 'cf-new';
  const pending = create.isPending || update.isPending;
  useEffect(() => { codeRef.current?.focus(); }, []);

  const patch = (p: Partial<FormState>) => { setF((s) => ({ ...s, ...p })); setErrors({}); setFormError(null); };
  const preview = useMemo(() => describeCoupon(f.code.trim(), f), [f]);
  const codeChanged = edit && coupon && f.code.trim().toUpperCase() !== coupon.code && (redeemed > 0 || coupon.timesRedeemed > 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = validateValue(f);
    const code = f.code.trim().toUpperCase();
    if (code.length < 3 || code.length > 40) errs.code = '3–40 characters.';
    else if (existing?.some((c) => c.code === code && c.id !== coupon?.id)) errs.code = 'A coupon with this code already exists.';
    const max = optInt(f.maxRedemptions);
    if (!max.ok) errs.maxRedemptions = 'Whole number, 1 or more.';
    const per = optInt(f.perTenant);
    if (!per.ok || per.value === undefined) errs.maxRedemptionsPerTenant = 'Whole number, 1 or more.';
    if (f.expires && !edit && f.expires < todayYmd()) errs.expiresAt = 'Must be today or later.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const body: UpsertCouponInput = {
      code, type: f.type, scope: f.scope, ...valuePayload(f),
      maxRedemptionsPerTenant: per.value!, isActive: f.isActive,
      ...(max.value ? { maxRedemptions: max.value } : {}),
      ...(f.expires ? { expiresAt: endOfDayIso(f.expires) } : {}),
    };
    const fail = (err: unknown) => {
      const msg = toCouponError(err).message;
      const fields = err instanceof CouponServiceError ? err.fields : {};
      const mapped = Object.keys(fields).length ? fields : (() => { const fl = fieldFromMessage(msg); return fl ? { [fl]: msg } : {}; })();
      setErrors(mapped);
      setFormError(msg);
      toast.error(msg);
    };
    if (coupon) {
      update.mutate({ id: coupon.id, input: body }, { onSuccess: (c) => { toast.success(`Coupon ${c.code} updated`); onSaved?.(c); onClose(); }, onError: fail });
    } else {
      create.mutate(body, { onSuccess: (c) => { toast.success(`Coupon ${c.code} created`); onSaved?.(c); onClose(); }, onError: fail });
    }
  };

  return (
    <motion.section
      aria-label={edit ? `Edit ${coupon?.code}` : 'New coupon'}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="rounded-[14px] border border-primary/40 bg-card"
    >
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><TicketPlus className="size-4" aria-hidden /></span>
        <h2 className="text-sm font-semibold">{edit ? <>Edit coupon <span className="font-mono">{coupon?.code}</span></> : 'New coupon'}</h2>
        <button type="button" onClick={onClose} aria-label="Close panel" className="ml-auto grid size-8 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" aria-hidden /></button>
      </header>
      <form onSubmit={submit} noValidate className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field id={`${idp}-code`} label="Code" error={errors.code} className="sm:col-span-2 xl:col-span-1">
            <div className="flex gap-2">
              <input ref={codeRef} id={`${idp}-code`} className={cn(fieldClass, 'font-mono uppercase')} placeholder="SAVE20" maxLength={40} autoComplete="off" spellCheck={false}
                value={f.code} onChange={(e) => patch({ code: e.target.value.toUpperCase().replace(/\s/g, '') })} aria-invalid={!!errors.code} />
              <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={() => patch({ code: randomCode() })}><Dices className="size-4" aria-hidden />Generate</Button>
            </div>
          </Field>
          <ValueInputs idp={idp} v={f} errors={errors} onChange={(p) => patch(p)} />
          <LimitInputs idp={idp} v={f} errors={errors} onChange={(p) => patch(p)} minDate={edit ? undefined : todayYmd()}
            hints={edit ? { maxRedemptions: 'Can be changed, not cleared (API limit)', expires: 'Can be changed, not cleared (API limit)' } : undefined} />
          <div className="flex items-end gap-2.5 pb-1.5">
            <Switch checked={f.isActive} onChange={(v) => patch({ isActive: v })} label="Coupon is active" />
            <span className="text-sm font-medium">{f.isActive ? 'Active' : 'Disabled'}</span>
          </div>
        </div>

        {codeChanged ? (
          <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            This coupon has already been redeemed. Changing its code means referral links and shared codes using <b className="font-mono">{coupon?.code}</b> stop working.
          </p>
        ) : null}
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-[13px]" aria-live="polite"><span className="mr-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</span>{preview}</p>
        {formError && !Object.keys(errors).length ? <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">{formError}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}{edit ? 'Save changes' : 'Create coupon'}</Button>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </motion.section>
  );
}
