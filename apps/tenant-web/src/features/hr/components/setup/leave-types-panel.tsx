'use client';

import * as React from 'react';
import { Check, Pencil, Plane, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { cn } from '@/lib/utils';
import { LEAVE_COLOR_CHOICES, leaveTypeColor, mix } from '../../lib/hr-palette';
import { hrFieldErrors, toHrError, useDeleteLeaveType, useLeaveTypes, useSaveLeaveType } from '../../hooks/use-hr';
import type { LeaveType } from '../../types';
import { FieldLabel, HrEmpty, HrError, HrPanel, RowsSkeleton, StaggerGroup, StaggerItem } from '../ui/hr-ui';
import { InlineDelete, SwitchRow } from './setup-ui';

function LeaveTypeForm({ type, onDone }: { type?: LeaveType; onDone: () => void }) {
  const save = useSaveLeaveType();
  const [name, setName] = React.useState(type?.name ?? '');
  const [code, setCode] = React.useState(type?.code ?? '');
  const [unlimited, setUnlimited] = React.useState(type ? type.yearlyQuota == null : false);
  const [quota, setQuota] = React.useState(type?.yearlyQuota != null ? String(type.yearlyQuota) : '12');
  const [isPaid, setPaid] = React.useState(type?.isPaid ?? true);
  const [carry, setCarry] = React.useState(type?.carryForward ?? false);
  const [carryMax, setCarryMax] = React.useState(type?.carryForwardMax != null ? String(type.carryForwardMax) : '');
  const [color, setColor] = React.useState(type?.color ?? LEAVE_COLOR_CHOICES[0]!.value);
  const [isActive, setActive] = React.useState(type?.isActive ?? true);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Give the leave type a name.';
    if (!/^[A-Z0-9_]{2,12}$/.test(code)) next.code = 'Use 2-12 capital letters, digits or underscores.';
    if (!unlimited && !(Number(quota) >= 0)) next.yearlyQuota = 'Enter the yearly quota.';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await save.mutateAsync({
        id: type?.id,
        payload: {
          name: name.trim(),
          code,
          yearlyQuota: unlimited ? null : Number(quota),
          isPaid,
          carryForward: carry,
          carryForwardMax: carry && carryMax !== '' ? Number(carryMax) : null,
          color,
          ...(type ? { isActive } : {}),
        },
      });
      toast.success(type ? 'Leave type updated.' : 'Leave type created.');
      onDone();
    } catch (err) {
      setErrors(hrFieldErrors(err));
      toast.error(toHrError(err).message);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-2xl border bg-muted/30 p-3.5" aria-label={type ? `Edit ${type.name}` : 'New leave type'}>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_160px]">
        <div>
          <FieldLabel htmlFor="lt-name" required>Name</FieldLabel>
          <Input id="lt-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} invalid={!!errors.name} placeholder="e.g. Casual Leave" />
          {errors.name ? <p className="mt-1 text-xs text-destructive">{errors.name}</p> : null}
        </div>
        <div>
          <FieldLabel htmlFor="lt-code" required>Code</FieldLabel>
          <Input id="lt-code" value={code} maxLength={12} onChange={(e) => setCode(e.target.value.toUpperCase())} invalid={!!errors.code} placeholder="CASUAL" disabled={!!type} className="font-mono" />
          {errors.code ? <p className="mt-1 text-xs text-destructive">{errors.code}</p> : null}
        </div>
        <div>
          <FieldLabel htmlFor="lt-quota">Yearly quota (days)</FieldLabel>
          <Input id="lt-quota" type="number" min={0} step={0.5} value={unlimited ? '' : quota} disabled={unlimited} onChange={(e) => setQuota(e.target.value)} invalid={!!errors.yearlyQuota} placeholder={unlimited ? 'Unlimited' : ''} />
          {errors.yearlyQuota ? <p className="mt-1 text-xs text-destructive">{errors.yearlyQuota}</p> : null}
        </div>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Colour</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Leave type colour">
          {LEAVE_COLOR_CHOICES.map((c) => (
            <button key={c.value} type="button" role="radio" aria-checked={color === c.value} aria-label={c.label} onClick={() => setColor(c.value)} className={cn('flex size-8 items-center justify-center rounded-full text-white transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', color === c.value && 'scale-110 ring-2 ring-foreground/60 ring-offset-2')} style={{ backgroundColor: c.value }}>
              {color === c.value ? <Check className="size-4" aria-hidden strokeWidth={3} /> : null}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-2 sm:grid-cols-2">
        <SwitchRow title="Unlimited" hint="No yearly cap (e.g. unpaid leave)" checked={unlimited} onChange={setUnlimited} />
        <SwitchRow title="Paid leave" hint="Paid days are not deducted from salary" checked={isPaid} onChange={setPaid} />
        <SwitchRow title="Carry forward" hint="Unused days roll into the next leave year" checked={carry} onChange={setCarry} />
        {type ? <SwitchRow title="Active" hint="Inactive types cannot be applied for" checked={isActive} onChange={setActive} /> : null}
      </div>
      {carry ? (
        <div className="max-w-[240px]">
          <FieldLabel htmlFor="lt-cmax">Carry forward cap (days)</FieldLabel>
          <Input id="lt-cmax" type="number" min={0} step={0.5} value={carryMax} onChange={(e) => setCarryMax(e.target.value)} placeholder="No cap" />
        </div>
      ) : null}
      <div className="flex gap-2">
        <LoadingButton type="submit" size="sm" loading={save.isPending}>{type ? 'Save leave type' : 'Create leave type'}</LoadingButton>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export function LeaveTypesPanel({ canEdit }: { canEdit: boolean }) {
  const q = useLeaveTypes(true);
  const del = useDeleteLeaveType();
  const [editing, setEditing] = React.useState<string | 'new' | null>(null);

  const remove = async (t: LeaveType) => {
    try {
      await del.mutateAsync(t.id);
      toast.success(`${t.name} deleted.`);
    } catch (e) {
      toast.error(toHrError(e).message);
    }
  };

  return (
    <HrPanel
      title="Leave types"
      subtitle="Quota, paid / unpaid and colour for each kind of leave"
      icon={Plane}
      tone="var(--chart-7)"
      action={canEdit ? <Button type="button" size="sm" onClick={() => setEditing(editing === 'new' ? null : 'new')} aria-expanded={editing === 'new'}><Plus className="size-4" /> Add leave type</Button> : null}
    >
      <div className="space-y-3">
        {editing === 'new' ? <LeaveTypeForm onDone={() => setEditing(null)} /> : null}
        {q.isPending ? (
          <RowsSkeleton rows={3} height={84} />
        ) : q.isError ? (
          <HrError message={q.error.message} onRetry={() => void q.refetch()} />
        ) : q.data.length === 0 ? (
          <HrEmpty icon={Plane} title="No leave types" compact />
        ) : (
          <StaggerGroup className="grid gap-3 md:grid-cols-2" step={0.05}>
            {q.data.map((t, i) => {
              const c = leaveTypeColor(t.color, i);
              return (
                <StaggerItem key={t.id}>
                  {editing === t.id ? (
                    <LeaveTypeForm type={t} onDone={() => setEditing(null)} />
                  ) : (
                    <div className={cn('rounded-2xl border p-3.5', !t.isActive && 'opacity-60')} style={{ backgroundImage: `linear-gradient(135deg, ${mix(c, 10)}, transparent)`, boxShadow: `inset 4px 0 0 ${c}` }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-1.5 text-[15px] font-extrabold">
                            {t.name}
                            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10.5px] font-bold">{t.code}</span>
                            {!t.isActive ? <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold">Inactive</span> : null}
                          </p>
                          <p className="mt-1 text-[13px] text-muted-foreground">
                            <b className="text-foreground">{t.yearlyQuota == null ? 'Unlimited' : `${t.yearlyQuota} days / year`}</b> · {t.isPaid ? 'Paid' : 'Unpaid'}
                            {t.carryForward ? ` · carry forward${t.carryForwardMax != null ? ` (max ${t.carryForwardMax})` : ''}` : ''}
                          </p>
                        </div>
                        {canEdit ? (
                          <div className="flex shrink-0 items-center">
                            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t.id)}><Pencil className="size-4" /></Button>
                            <InlineDelete label={t.name} pending={del.isPending} onConfirm={() => remove(t)} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        )}
        {!canEdit ? <p className="text-xs text-muted-foreground">You can view leave types but not change them.</p> : null}
      </div>
    </HrPanel>
  );
}
