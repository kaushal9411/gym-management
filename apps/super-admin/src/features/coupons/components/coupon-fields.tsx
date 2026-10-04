'use client';

import { cn } from '@/lib/utils';
import { fieldClass, fmtDate } from '@/features/tenants/components/detail/tabs/_shared/kit';
import type { CouponScope, CouponType } from '../types';
import { SCOPE_LABEL, TYPE_LABEL, valueLabel, type ValueFields } from './lib';

export function Field({ id, label, error, hint, children, className }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <label htmlFor={id} className="block text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
      {error ? <p id={`${id}-err`} role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">{error}</p> : hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const inv = (err?: string) => (err ? { 'aria-invalid': true } : {});

/** Type select + the matching value field(s). */
export function ValueInputs({ idp, v, onChange, errors }: { idp: string; v: ValueFields; onChange: (p: Partial<ValueFields>) => void; errors: Record<string, string> }) {
  return (
    <>
      <Field id={`${idp}-type`} label="Type">
        <select id={`${idp}-type`} className={fieldClass} value={v.type} onChange={(e) => onChange({ type: e.target.value as CouponType })}>
          {(Object.keys(TYPE_LABEL) as CouponType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
      </Field>
      {v.type === 'PERCENTAGE' ? (
        <Field id={`${idp}-pct`} label="Percent off (1–100)" error={errors.percentOff}>
          <input id={`${idp}-pct`} type="number" inputMode="decimal" min={1} max={100} className={fieldClass} value={v.percentOff} onChange={(e) => onChange({ percentOff: e.target.value })} {...inv(errors.percentOff)} />
        </Field>
      ) : v.type === 'FIXED_AMOUNT' ? (
        <div className="grid grid-cols-[1fr_96px] gap-2">
          <Field id={`${idp}-amt`} label="Amount off" error={errors.amountOff}>
            <input id={`${idp}-amt`} type="number" inputMode="decimal" min={0} className={fieldClass} value={v.amountOff} onChange={(e) => onChange({ amountOff: e.target.value })} {...inv(errors.amountOff)} />
          </Field>
          <Field id={`${idp}-cur`} label="Currency" error={errors.currency}>
            <input id={`${idp}-cur`} maxLength={3} className={cn(fieldClass, 'font-mono uppercase')} value={v.currency} onChange={(e) => onChange({ currency: e.target.value.toUpperCase() })} {...inv(errors.currency)} />
          </Field>
        </div>
      ) : (
        <Field id={`${idp}-days`} label="Trial extension (days)" error={errors.trialExtensionDays}>
          <input id={`${idp}-days`} type="number" inputMode="numeric" min={1} className={fieldClass} value={v.trialDays} onChange={(e) => onChange({ trialDays: e.target.value })} {...inv(errors.trialExtensionDays)} />
        </Field>
      )}
    </>
  );
}

export interface LimitFields { scope: CouponScope; maxRedemptions: string; perTenant: string; expires: string }

/** Scope, redemption limits and expiry. `minDate` blocks past dates on create. */
export function LimitInputs({ idp, v, onChange, errors, minDate, hints = {} }: { idp: string; v: LimitFields; onChange: (p: Partial<LimitFields>) => void; errors: Record<string, string>; minDate?: string; hints?: Partial<Record<'maxRedemptions' | 'expires', string>> }) {
  return (
    <>
      <Field id={`${idp}-scope`} label="Scope">
        <select id={`${idp}-scope`} className={fieldClass} value={v.scope} onChange={(e) => onChange({ scope: e.target.value as CouponScope })}>
          {(Object.keys(SCOPE_LABEL) as CouponScope[]).map((s) => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}
        </select>
      </Field>
      <Field id={`${idp}-max`} label="Max redemptions (total)" error={errors.maxRedemptions} hint={hints.maxRedemptions ?? 'Blank = unlimited'}>
        <input id={`${idp}-max`} type="number" inputMode="numeric" min={1} className={fieldClass} placeholder="∞" value={v.maxRedemptions} onChange={(e) => onChange({ maxRedemptions: e.target.value })} {...inv(errors.maxRedemptions)} />
      </Field>
      <Field id={`${idp}-per`} label="Max per tenant" error={errors.maxRedemptionsPerTenant}>
        <input id={`${idp}-per`} type="number" inputMode="numeric" min={1} className={fieldClass} value={v.perTenant} onChange={(e) => onChange({ perTenant: e.target.value })} {...inv(errors.maxRedemptionsPerTenant)} />
      </Field>
      <Field id={`${idp}-exp`} label="Expires" error={errors.expiresAt} hint={hints.expires ?? 'Blank = never'}>
        <input id={`${idp}-exp`} type="date" min={minDate} className={fieldClass} value={v.expires} onChange={(e) => onChange({ expires: e.target.value })} {...inv(errors.expiresAt)} />
      </Field>
    </>
  );
}

/** "SAVE20 gives 20% off, once per tenant, until 31 Dec 2026, 100 uses." */
export function describeCoupon(code: string, v: ValueFields & LimitFields): string {
  const val = valueLabel({
    type: v.type, percentOff: v.percentOff || '0', amountOff: v.amountOff || '0',
    currency: v.currency || 'INR', trialExtensionDays: Number(v.trialDays) || 0,
  });
  const per = Number(v.perTenant) || 1;
  const parts = [`${code || 'This coupon'} gives ${val}`, per === 1 ? 'once per tenant' : `up to ${per} times per tenant`];
  if (v.scope !== 'ONE_TIME') parts.push(`${SCOPE_LABEL[v.scope].toLowerCase()} scope`);
  parts.push(v.expires ? `until ${fmtDate(`${v.expires}T12:00:00`)}` : 'no expiry');
  parts.push(v.maxRedemptions ? `${v.maxRedemptions} uses` : 'unlimited uses');
  return `${parts.join(', ')}.`;
}
