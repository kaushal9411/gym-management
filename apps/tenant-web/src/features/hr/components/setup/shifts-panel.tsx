'use client';

import * as React from 'react';
import { Clock3, Pencil, Plus, Star, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { cn } from '@/lib/utils';
import { weekdayShort, WEEKDAYS } from '../../lib/status';
import { hrFieldErrors, toHrError, useDeleteShift, useSaveShift, useShifts } from '../../hooks/use-hr';
import type { Shift, Weekday } from '../../types';
import { FieldLabel, HrEmpty, HrError, HrPanel, RowsSkeleton, StaggerGroup, StaggerItem } from '../ui/hr-ui';
import { InlineDelete, SwitchRow } from './setup-ui';

function ShiftForm({ shift, onDone }: { shift?: Shift; onDone: () => void }) {
  const save = useSaveShift();
  const [name, setName] = React.useState(shift?.name ?? '');
  const [start, setStart] = React.useState(shift?.startTime ?? '06:00');
  const [end, setEnd] = React.useState(shift?.endTime ?? '21:00');
  const [grace, setGrace] = React.useState(String(shift?.graceMinutes ?? 10));
  const [off, setOff] = React.useState<Weekday[]>(shift?.weeklyOffDays ?? ['SUNDAY']);
  const [isDefault, setDefault] = React.useState(shift?.isDefault ?? false);
  const [isActive, setActive] = React.useState(shift?.isActive ?? true);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Give the shift a name.';
    if (end <= start) next.endTime = 'End time must be after the start time.';
    if (!(Number(grace) >= 0)) next.graceMinutes = 'Enter 0 or more minutes.';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await save.mutateAsync({ id: shift?.id, payload: { name: name.trim(), startTime: start, endTime: end, graceMinutes: Number(grace), weeklyOffDays: off, isDefault, ...(shift ? { isActive } : {}) } });
      toast.success(shift ? 'Shift updated.' : 'Shift created.');
      onDone();
    } catch (err) {
      setErrors(hrFieldErrors(err));
      toast.error(toHrError(err).message);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-2xl border bg-muted/30 p-3.5" aria-label={shift ? `Edit ${shift.name}` : 'New shift'}>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="sh-name" required>Name</FieldLabel>
          <Input id="sh-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} invalid={!!errors.name} placeholder="e.g. Morning" />
          {errors.name ? <p className="mt-1 text-xs text-destructive">{errors.name}</p> : null}
        </div>
        <div>
          <FieldLabel htmlFor="sh-start">Starts</FieldLabel>
          <Input id="sh-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="sh-end">Ends</FieldLabel>
          <Input id="sh-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} invalid={!!errors.endTime} />
          {errors.endTime ? <p className="mt-1 text-xs text-destructive">{errors.endTime}</p> : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <div>
          <FieldLabel htmlFor="sh-grace">Grace (minutes)</FieldLabel>
          <Input id="sh-grace" type="number" min={0} max={240} value={grace} onChange={(e) => setGrace(e.target.value)} invalid={!!errors.graceMinutes} />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Weekly off</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = off.includes(d.value);
              return (
                <button key={d.value} type="button" aria-pressed={on} onClick={() => setOff((c) => (c.includes(d.value) ? c.filter((x) => x !== d.value) : [...c, d.value]))} className={cn('h-9 min-w-[48px] rounded-xl border px-2.5 text-[13px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', on ? 'border-transparent text-white' : 'hover:bg-accent')} style={on ? { backgroundColor: 'var(--chart-3)' } : undefined}>
                  {d.short}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <SwitchRow title="Default shift" hint="Used by employees without their own shift" checked={isDefault} onChange={setDefault} />
        {shift ? <SwitchRow title="Active" hint="Inactive shifts cannot be assigned" checked={isActive} onChange={setActive} /> : null}
      </div>
      <div className="flex gap-2">
        <LoadingButton type="submit" size="sm" loading={save.isPending}>{shift ? 'Save shift' : 'Create shift'}</LoadingButton>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export function ShiftsPanel({ canEdit }: { canEdit: boolean }) {
  const q = useShifts();
  const del = useDeleteShift();
  const [editing, setEditing] = React.useState<string | 'new' | null>(null);

  const remove = async (s: Shift) => {
    try {
      await del.mutateAsync(s.id);
      toast.success(`${s.name} deleted.`);
    } catch (e) {
      toast.error(toHrError(e).message);
    }
  };

  return (
    <HrPanel
      title="Shifts"
      subtitle="Working hours, grace time and weekly offs"
      icon={Clock3}
      tone="var(--chart-3)"
      action={canEdit ? <Button type="button" size="sm" onClick={() => setEditing(editing === 'new' ? null : 'new')} aria-expanded={editing === 'new'}><Plus className="size-4" /> Add shift</Button> : null}
    >
      <div className="space-y-3">
        {editing === 'new' ? <ShiftForm onDone={() => setEditing(null)} /> : null}
        {q.isPending ? (
          <RowsSkeleton rows={2} height={90} />
        ) : q.isError ? (
          <HrError message={q.error.message} onRetry={() => void q.refetch()} />
        ) : q.data.length === 0 ? (
          <HrEmpty icon={Clock3} title="No shifts" description="Add a shift so late marks and weekly offs follow your hours." compact />
        ) : (
          <StaggerGroup className="grid gap-3 md:grid-cols-2" step={0.05}>
            {q.data.map((s) => (
              <StaggerItem key={s.id}>
                {editing === s.id ? (
                  <ShiftForm shift={s} onDone={() => setEditing(null)} />
                ) : (
                  <div className={cn('rounded-2xl border p-3.5', !s.isActive && 'opacity-60')}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="flex items-center gap-1.5 text-[15px] font-extrabold">
                          {s.name}
                          {s.isDefault ? <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary"><Star className="size-3" aria-hidden /> Default</span> : null}
                          {!s.isActive ? <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold">Inactive</span> : null}
                        </p>
                        <p className="mt-0.5 text-lg font-extrabold tabular-nums">{s.startTime} - {s.endTime}</p>
                      </div>
                      {canEdit ? (
                        <div className="flex items-center">
                          <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s.id)}><Pencil className="size-4" /></Button>
                          <InlineDelete label={s.name} pending={del.isPending} onConfirm={() => remove(s)} />
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Late after {s.graceMinutes} min grace · off {s.weeklyOffDays.length ? s.weeklyOffDays.map(weekdayShort).join(', ') : 'none'}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold"><Users className="size-3.5" aria-hidden /> {s.employeeCount} employee{s.employeeCount === 1 ? '' : 's'}</p>
                  </div>
                )}
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}
        {!canEdit ? <p className="text-xs text-muted-foreground">You can view shifts but not change them.</p> : null}
      </div>
    </HrPanel>
  );
}
