'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import type { BodyMeasurement } from '@/features/measurements/types';
import { useLogMeasurement, useUpdateMeasurement } from '../../hooks/use-member-portal';
import type { MemberMeasurementInput } from '../../services/member-portal.service';
import { Field, FieldInput } from '../profile/fields';
import { SheetModal } from '../kit';

type NumKey = 'weightKg' | 'heightCm' | 'bodyFatPercent' | 'chestCm' | 'waistCm' | 'hipsCm' | 'bicepsCm' | 'thighsCm';
type FormState = Record<NumKey, string> & { recordedAt: string; notes: string };

/** Bounds mirror the API's `measurementFields` validator, so a bad value is caught before the round-trip. */
const NUM_FIELDS: { key: NumKey; label: string; unit: string; min: number; max: number; group: 'core' | 'girth' }[] = [
  { key: 'weightKg', label: 'Weight', unit: 'kg', min: 0, max: 500, group: 'core' },
  { key: 'bodyFatPercent', label: 'Body fat', unit: '%', min: 0, max: 80, group: 'core' },
  { key: 'heightCm', label: 'Height', unit: 'cm', min: 0, max: 300, group: 'core' },
  { key: 'chestCm', label: 'Chest', unit: 'cm', min: 0, max: 300, group: 'girth' },
  { key: 'waistCm', label: 'Waist', unit: 'cm', min: 0, max: 300, group: 'girth' },
  { key: 'hipsCm', label: 'Hips', unit: 'cm', min: 0, max: 300, group: 'girth' },
  { key: 'bicepsCm', label: 'Biceps', unit: 'cm', min: 0, max: 150, group: 'girth' },
  { key: 'thighsCm', label: 'Thighs', unit: 'cm', min: 0, max: 200, group: 'girth' },
];
const MAX_BACKDATE_DAYS = 365;

const pad = (n: number) => String(n).padStart(2, '0');
const dayString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayString = () => dayString(new Date());
const oldestString = () => dayString(new Date(Date.now() - MAX_BACKDATE_DAYS * 86_400_000));

/** An existing entry's `recordedAt` is a timestamp — show it as the calendar day it was logged for. */
const entryDay = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? todayString() : dayString(d);
};

const blank = (): FormState => ({ weightKg: '', heightCm: '', bodyFatPercent: '', chestCm: '', waistCm: '', hipsCm: '', bicepsCm: '', thighsCm: '', recordedAt: todayString(), notes: '' });

function fromEntry(e: BodyMeasurement): FormState {
  const s = blank();
  for (const f of NUM_FIELDS) s[f.key] = e[f.key] ?? '';
  s.recordedAt = entryDay(e.recordedAt);
  s.notes = e.notes ?? '';
  return s;
}

export type LogMode = 'quick' | 'full';

/**
 * Member self-service log: "Quick weight" (weight + date) or "Full check-in"
 * (every measurement + notes). Pass `entry` to edit one the member logged
 * (full form, prefilled). The API keeps one MEMBER entry per day — logging
 * again on the same day merges into it — and a PATCH can't clear a value, so
 * blanking a field on edit leaves it unchanged (hint shown).
 */
export function MeasurementLogSheet({
  open,
  onOpenChange,
  mode,
  entry,
  heightHint,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: LogMode;
  entry?: BodyMeasurement | null;
  /** Latest known height (cm) — shown as a hint so BMI works without re-entering it. */
  heightHint?: number | null;
}) {
  // The sheet content unmounts when closed, so state is fresh on every open without a reset effect.
  return (
    <SheetModal
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? 'Edit check-in' : mode === 'quick' ? 'Log your weight' : 'Full check-in'}
      description={entry ? 'Update the values you logged.' : mode === 'quick' ? 'Takes five seconds — log it daily or weekly to track your trend.' : 'Add as many measurements as you like. Leave the rest blank.'}
      className="md:max-w-xl"
    >
      {open ? <LogForm key={entry?.id ?? mode} mode={mode} entry={entry ?? null} heightHint={heightHint ?? null} onDone={() => onOpenChange(false)} /> : null}
    </SheetModal>
  );
}

function LogForm({ mode, entry, heightHint, onDone }: { mode: LogMode; entry: BodyMeasurement | null; heightHint: number | null; onDone: () => void }) {
  const create = useLogMeasurement();
  const update = useUpdateMeasurement();
  const saving = create.isPending || update.isPending;
  const full = !!entry || mode === 'full';
  const [form, setForm] = React.useState<FormState>(() => (entry ? fromEntry(entry) : blank()));
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const set = (k: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  const fields = full ? NUM_FIELDS : NUM_FIELDS.filter((f) => f.key === 'weightKg');

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (saving) return;
    const errs: Partial<Record<keyof FormState, string>> = {};
    const input: MemberMeasurementInput = {};
    for (const f of fields) {
      const raw = form[f.key].trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) errs[f.key] = 'Enter a number';
      else if (n < f.min || (f.key !== 'bodyFatPercent' && n === 0)) errs[f.key] = f.key === 'bodyFatPercent' ? 'Cannot be negative' : 'Must be greater than 0';
      else if (n > f.max) errs[f.key] = `Must be ${f.max} ${f.unit} or less`;
      else input[f.key] = n;
    }
    if (!form.recordedAt) errs.recordedAt = 'Choose a date';
    else if (form.recordedAt > todayString()) errs.recordedAt = 'Cannot be in the future';
    else if (form.recordedAt < oldestString()) errs.recordedAt = 'Cannot be more than a year ago';
    const hasValue = Object.keys(input).length > 0;
    if (!hasValue && !Object.keys(errs).length) errs.weightKg = 'Enter at least one measurement';
    const notes = form.notes.trim();
    if (full && notes.length > 1000) errs.notes = 'Keep notes under 1000 characters';
    setErrors(errs);
    if (Object.keys(errs).length) return setBanner('Please fix the highlighted fields.');
    setBanner(null);

    if (full && notes) input.notes = notes;
    // A new entry for today needs no date; a past one (or an edit that moved the day) sends it.
    const dateChanged = entry ? form.recordedAt !== entryDay(entry.recordedAt) : form.recordedAt !== todayString();
    if (dateChanged) input.recordedAt = form.recordedAt;

    const onSuccess = () => {
      toast.success(entry ? 'Check-in updated' : 'Saved — nice work!');
      onDone();
    };
    const onError = (err: Error) => {
      const fe: Partial<Record<keyof FormState, string>> = {};
      for (const part of err.message.split('; ')) {
        const m = /^([A-Za-z]+): (.+)$/.exec(part);
        if (m && m[1] && m[1] in form && !fe[m[1] as keyof FormState]) fe[m[1] as keyof FormState] = m[2];
      }
      setErrors(fe);
      setBanner(Object.keys(fe).length ? 'Please fix the highlighted fields.' : err.message || 'Something went wrong. Please try again.');
    };
    if (entry) update.mutate({ id: entry.id, input }, { onSuccess, onError });
    else create.mutate(input, { onSuccess, onError });
  };

  const input = (f: (typeof NUM_FIELDS)[number]) => (
    <Field
      key={f.key}
      id={`ml-${f.key}`}
      label={`${f.label} (${f.unit})`}
      error={errors[f.key]}
      hint={f.key === 'heightCm' && heightHint ? `Last recorded: ${heightHint} cm` : undefined}
    >
      <FieldInput
        id={`ml-${f.key}`}
        name={f.key}
        type="number"
        inputMode="decimal"
        step="0.1"
        min={0}
        value={form[f.key]}
        invalid={!!errors[f.key]}
        disabled={saving}
        onChange={(e) => set(f.key, e.target.value)}
      />
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {banner ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {banner}
        </p>
      ) : null}

      {full ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">{NUM_FIELDS.filter((f) => f.group === 'core').map((f) => input(f))}</div>
          <div>
            <p className="mb-2 text-sm font-semibold">Girths</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{NUM_FIELDS.filter((f) => f.group === 'girth').map((f) => input(f))}</div>
          </div>
        </>
      ) : (
        <div className="grid gap-4">{fields.map((f) => input(f))}</div>
      )}

      <Field id="ml-recordedAt" label="Date" error={errors.recordedAt} hint="Logging again on the same day updates that day's entry.">
        <FieldInput id="ml-recordedAt" name="recordedAt" type="date" max={todayString()} min={oldestString()} value={form.recordedAt} invalid={!!errors.recordedAt} disabled={saving} onChange={(e) => set('recordedAt', e.target.value)} />
      </Field>

      {full ? (
        <Field id="ml-notes" label="Notes (optional)" error={errors.notes}>
          <textarea
            id="ml-notes"
            name="notes"
            rows={3}
            maxLength={1000}
            value={form.notes}
            disabled={saving}
            onChange={(e) => set('notes', e.target.value)}
            className="w-full resize-none rounded-md border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:text-sm"
          />
        </Field>
      ) : null}

      {entry ? <p className="text-xs text-muted-foreground">Clearing a value does not remove it — to remove a whole check-in, delete it instead.</p> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="min-h-11" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <LoadingButton type="submit" className="min-h-11" loading={saving} loadingText="Saving…">
          {entry ? 'Save changes' : 'Save'}
        </LoadingButton>
      </div>
    </form>
  );
}
