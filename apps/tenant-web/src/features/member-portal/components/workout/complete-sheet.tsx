'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { cn } from '@/lib/utils';
import { Field, FieldInput } from '../profile/fields';
import { SheetModal } from '../kit';
import { EFFORT_LABELS, WORKOUT_LIMITS, type WorkoutCompleteInput } from '../../lib/workout-tracking';
import { PressButton } from './workout-motion';

/**
 * "Complete workout": every exercise of the day that is not logged yet becomes
 * done (skipped ones stay skipped). Optional total duration and a simple 1-5
 * effort rating are stored for the day.
 */
export function CompleteSheet({
  open,
  onOpenChange,
  dayLabel,
  remaining,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayLabel: string;
  /** How many exercises are still unlogged (they will be marked done). */
  remaining: number;
  onComplete: (input: Pick<WorkoutCompleteInput, 'durationMin' | 'effort' | 'notes'>) => Promise<void>;
}) {
  return (
    <SheetModal
      open={open}
      onOpenChange={onOpenChange}
      title="Finish workout"
      description={remaining > 0 ? `${remaining} remaining ${remaining === 1 ? 'exercise' : 'exercises'} will be marked done for ${dayLabel}.` : `Save how ${dayLabel} went.`}
      className="md:max-w-md"
    >
      {open ? <CompleteForm onComplete={onComplete} onCancel={() => onOpenChange(false)} /> : null}
    </SheetModal>
  );
}

function CompleteForm({ onComplete, onCancel }: { onComplete: (i: Pick<WorkoutCompleteInput, 'durationMin' | 'effort' | 'notes'>) => Promise<void>; onCancel: () => void }) {
  const [minutes, setMinutes] = React.useState('');
  const [effort, setEffort] = React.useState<number | null>(null);
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<string | undefined>();
  const [saving, setSaving] = React.useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (saving) return;
    const input: Pick<WorkoutCompleteInput, 'durationMin' | 'effort' | 'notes'> = {};
    if (minutes.trim()) {
      const n = Number(minutes);
      const { min, max } = WORKOUT_LIMITS.durationMin;
      if (!Number.isInteger(n) || n < min || n > max) return setFieldError(`Enter whole minutes between ${min} and ${max}`);
      input.durationMin = n;
    }
    setFieldError(undefined);
    if (effort) input.effort = effort;
    if (notes.trim()) input.notes = notes.trim();
    setError(null);
    setSaving(true);
    try {
      await onComplete(input);
      onCancel();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      ) : null}
      <Field id="wc-minutes" label="How long did it take? (min, optional)" error={fieldError}>
        <FieldInput id="wc-minutes" name="durationMin" type="number" inputMode="numeric" min={1} step={1} value={minutes} invalid={!!fieldError} disabled={saving} onChange={(e) => setMinutes(e.target.value)} />
      </Field>
      <div className="space-y-1.5">
        <p className="text-sm font-medium leading-none">How hard was it? (optional)</p>
        <div role="radiogroup" aria-label="Effort from 1 to 5" className="grid grid-cols-5 gap-1.5 pt-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const on = effort === n;
            return (
              <PressButton
                key={n}
                role="radio"
                aria-checked={on}
                aria-label={`${n} - ${EFFORT_LABELS[n]}`}
                disabled={saving}
                onClick={() => setEffort(on ? null : n)}
                className={cn('flex min-h-14 flex-col items-center justify-center rounded-xl border text-base font-semibold', on ? 'border-transparent bg-primary text-primary-foreground shadow-md' : 'bg-background hover:bg-muted')}
              >
                {n}
                <span className={cn('text-[10px] font-medium', on ? 'text-primary-foreground/85' : 'text-muted-foreground')}>{EFFORT_LABELS[n]}</span>
              </PressButton>
            );
          })}
        </div>
      </div>
      <Field id="wc-notes" label="Note (optional)">
        <textarea
          id="wc-notes"
          rows={2}
          maxLength={WORKOUT_LIMITS.notes}
          value={notes}
          disabled={saving}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:text-sm"
        />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="min-h-11" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <LoadingButton type="submit" className="min-h-11" loading={saving} loadingText="Saving…">
          Finish workout
        </LoadingButton>
      </div>
    </form>
  );
}
