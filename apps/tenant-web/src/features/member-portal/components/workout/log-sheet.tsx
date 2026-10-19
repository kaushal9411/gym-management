'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Field, FieldInput } from '../profile/fields';
import { SheetModal } from '../kit';
import { WORKOUT_LIMITS } from '../../lib/workout-tracking';

export interface LogDetails {
  setsDone: number | null;
  repsDone: number | null;
  weightKg: number | null;
  durationMin: number | null;
  notes: string | null;
}

type Form = { setsDone: string; repsDone: string; weightKg: string; durationMin: string; notes: string };

const toForm = (d?: Partial<LogDetails> | null): Form => ({
  setsDone: d?.setsDone != null ? String(d.setsDone) : '',
  repsDone: d?.repsDone != null ? String(d.repsDone) : '',
  weightKg: d?.weightKg != null ? String(d.weightKg) : '',
  durationMin: d?.durationMin != null ? String(d.durationMin) : '',
  notes: d?.notes ?? '',
});

const FIELDS: { key: Exclude<keyof Form, 'notes'>; label: string; step: string; integer: boolean }[] = [
  { key: 'setsDone', label: 'Sets done', step: '1', integer: true },
  { key: 'repsDone', label: 'Reps per set', step: '1', integer: true },
  { key: 'weightKg', label: 'Weight (kg)', step: '0.5', integer: false },
  { key: 'durationMin', label: 'Duration (min)', step: '1', integer: true },
];

/**
 * Optional sets / reps / weight / duration / note for one exercise. Saving marks
 * the exercise done (or, when editing a history entry, only updates its details).
 * All fields are optional; blank means "not logged" (an edit clears it).
 */
export function LogSheet({
  open,
  onOpenChange,
  title,
  description,
  initial,
  hint,
  submitLabel,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  initial?: Partial<LogDetails> | null;
  /** e.g. the plan's target: "Plan: 4 x 8". */
  hint?: string | null;
  submitLabel: string;
  onSave: (details: LogDetails) => Promise<void>;
}) {
  return (
    <SheetModal open={open} onOpenChange={onOpenChange} title={title} description={description} className="md:max-w-md">
      {open ? <LogForm initial={initial ?? null} hint={hint ?? null} submitLabel={submitLabel} onSave={onSave} onCancel={() => onOpenChange(false)} /> : null}
    </SheetModal>
  );
}

function LogForm({ initial, hint, submitLabel, onSave, onCancel }: { initial: Partial<LogDetails> | null; hint: string | null; submitLabel: string; onSave: (d: LogDetails) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = React.useState<Form>(() => toForm(initial));
  const [errors, setErrors] = React.useState<Partial<Record<keyof Form, string>>>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const set = (k: keyof Form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (saving) return;
    const errs: Partial<Record<keyof Form, string>> = {};
    const out: LogDetails = { setsDone: null, repsDone: null, weightKg: null, durationMin: null, notes: null };
    for (const f of FIELDS) {
      const raw = form[f.key].trim();
      if (!raw) continue;
      const n = Number(raw);
      const lim = WORKOUT_LIMITS[f.key];
      if (!Number.isFinite(n)) errs[f.key] = 'Enter a number';
      else if (f.integer && !Number.isInteger(n)) errs[f.key] = 'Use a whole number';
      else if (n < lim.min) errs[f.key] = `Must be at least ${lim.min}`;
      else if (n > lim.max) errs[f.key] = `Must be ${lim.max} or less`;
      else out[f.key] = n;
    }
    const notes = form.notes.trim();
    if (notes.length > WORKOUT_LIMITS.notes) errs.notes = `Keep notes under ${WORKOUT_LIMITS.notes} characters`;
    else out.notes = notes || null;
    setErrors(errs);
    if (Object.keys(errs).length) return setBanner('Please fix the highlighted fields.');
    setBanner(null);
    setSaving(true);
    try {
      await onSave(out);
      onCancel();
    } catch (err) {
      const fe: Partial<Record<keyof Form, string>> = {};
      const message = err instanceof Error ? err.message : '';
      for (const part of message.split('; ')) {
        const m = /^([A-Za-z]+): (.+)$/.exec(part);
        if (m && m[1] && m[1] in form && !fe[m[1] as keyof Form]) fe[m[1] as keyof Form] = m[2];
      }
      setErrors(fe);
      setBanner(Object.keys(fe).length ? 'Please fix the highlighted fields.' : message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {banner ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {banner}
        </p>
      ) : null}
      {hint ? <p className="rounded-xl bg-muted px-3.5 py-2.5 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <Field key={f.key} id={`wl-${f.key}`} label={f.label} error={errors[f.key]}>
            <FieldInput id={`wl-${f.key}`} name={f.key} type="number" inputMode={f.integer ? 'numeric' : 'decimal'} step={f.step} min={0} value={form[f.key]} invalid={!!errors[f.key]} disabled={saving} onChange={(e) => set(f.key, e.target.value)} />
          </Field>
        ))}
      </div>
      <Field id="wl-notes" label="Note (optional)" error={errors.notes}>
        <textarea
          id="wl-notes"
          name="notes"
          rows={2}
          maxLength={WORKOUT_LIMITS.notes}
          value={form.notes}
          disabled={saving}
          onChange={(e) => set('notes', e.target.value)}
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:text-sm"
        />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="min-h-11" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <LoadingButton type="submit" className="min-h-11" loading={saving} loadingText="Saving…">
          {submitLabel}
        </LoadingButton>
      </div>
    </form>
  );
}
