'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, PartyPopper, Plus, Star } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { formatDay, formatMonth, todayYmd } from '../../lib/dates';
import { hrFieldErrors, toHrError, useCreateHoliday, useDeleteHoliday, useHolidays } from '../../hooks/use-hr';
import type { Holiday } from '../../types';
import { FieldLabel, HrEmpty, HrError, HrPanel, RowsSkeleton } from '../ui/hr-ui';
import { InlineDelete } from './setup-ui';

function AddHoliday({ year, onDone }: { year: number; onDone: () => void }) {
  const create = useCreateHoliday();
  const [date, setDate] = React.useState(`${year}-01-01`);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!date) next.date = 'Pick a date.';
    if (!name.trim()) next.name = 'Name the holiday.';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await create.mutateAsync({ date, name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}) });
      toast.success(`${name.trim()} added to the calendar.`);
      onDone();
    } catch (err) {
      setErrors(hrFieldErrors(err));
      toast.error(toHrError(err).message);
    }
  };
  return (
    <form onSubmit={submit} noValidate className="grid gap-3 rounded-2xl border bg-muted/30 p-3.5 sm:grid-cols-[170px_1fr_1fr_auto] sm:items-end" aria-label="Add holiday">
      <div>
        <FieldLabel htmlFor="hd-date" required>Date</FieldLabel>
        <Input id="hd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} invalid={!!errors.date} />
        {errors.date ? <p className="mt-1 text-xs text-destructive">{errors.date}</p> : null}
      </div>
      <div>
        <FieldLabel htmlFor="hd-name" required>Name</FieldLabel>
        <Input id="hd-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} invalid={!!errors.name} placeholder="e.g. Diwali" />
        {errors.name ? <p className="mt-1 text-xs text-destructive">{errors.name}</p> : null}
      </div>
      <div>
        <FieldLabel htmlFor="hd-desc">Note</FieldLabel>
        <Input id="hd-desc" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
      </div>
      <div className="flex gap-2">
        <LoadingButton type="submit" loading={create.isPending}>Add</LoadingButton>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export function HolidaysPanel({ canEdit }: { canEdit: boolean }) {
  const [year, setYear] = React.useState(Number(todayYmd().slice(0, 4)));
  const [adding, setAdding] = React.useState(false);
  const q = useHolidays({ year });
  const del = useDeleteHoliday();
  const today = todayYmd();

  const remove = async (h: Holiday) => {
    try {
      await del.mutateAsync(h.id);
      toast.success(`${h.name} removed.`);
    } catch (e) {
      toast.error(toHrError(e).message);
    }
  };

  const grouped = React.useMemo(() => {
    const map = new Map<string, Holiday[]>();
    for (const h of q.data ?? []) map.set(h.date.slice(0, 7), [...(map.get(h.date.slice(0, 7)) ?? []), h]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [q.data]);

  return (
    <HrPanel
      title="Holiday calendar"
      subtitle="Holidays are paid and are skipped when counting leave days"
      icon={PartyPopper}
      tone="var(--chart-5)"
      action={
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Year" className="inline-flex items-center gap-0.5 rounded-full border bg-card p-0.5">
            <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}><ChevronLeft className="size-4" /></Button>
            <span className="min-w-[48px] text-center text-sm font-extrabold tabular-nums" aria-live="polite">{year}</span>
            <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Next year" onClick={() => setYear((y) => y + 1)}><ChevronRight className="size-4" /></Button>
          </div>
          {canEdit ? <Button type="button" size="sm" onClick={() => setAdding((v) => !v)} aria-expanded={adding}><Plus className="size-4" /> Add holiday</Button> : null}
        </div>
      }
    >
      <div className="space-y-3">
        {adding && canEdit ? <AddHoliday year={year} onDone={() => setAdding(false)} /> : null}
        {q.isPending ? (
          <RowsSkeleton rows={3} height={44} />
        ) : q.isError ? (
          <HrError message={q.error.message} onRetry={() => void q.refetch()} />
        ) : grouped.length === 0 ? (
          <HrEmpty icon={PartyPopper} title={`No holidays in ${year}`} description={canEdit ? 'Add public holidays so payroll and leave counting stay accurate.' : undefined} compact />
        ) : (
          grouped.map(([ym, list]) => (
            <div key={ym}>
              <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{formatMonth(ym)}</p>
              <ul className="grid gap-2 md:grid-cols-2">
                {list.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 rounded-xl border px-3 py-2" style={{ opacity: h.date < today ? 0.7 : 1 }}>
                    <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-[color:color-mix(in_oklch,var(--chart-5)_14%,transparent)] leading-tight text-[color:var(--chart-5)]">
                      <span className="text-base font-extrabold tabular-nums">{Number(h.date.slice(8))}</span>
                      <span className="text-[9px] font-bold uppercase">{formatDay(h.date).split(' ')[1]}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 truncate text-[13.5px] font-bold"><Star className="size-3.5 shrink-0 text-[color:var(--chart-5)]" aria-hidden />{h.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{formatDay(h.date, 'weekday')}{h.branch ? ` · ${h.branch.name}` : ' · all branches'}{h.description ? ` · ${h.description}` : ''}</p>
                    </div>
                    {canEdit ? <InlineDelete label={h.name} pending={del.isPending} onConfirm={() => remove(h)} /> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </HrPanel>
  );
}
