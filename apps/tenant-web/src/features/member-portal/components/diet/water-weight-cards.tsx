'use client';

import * as React from 'react';
import { Droplets, Minus, NotebookPen, Plus, Scale } from 'lucide-react';

import { fmtNum } from '../../lib/diet-nutrition';
import { SectionCard, toneColor, toneTint } from '../kit';
import { GrowBar, PressButton } from './motion-bits';

/** Water for the selected day: progress against the (stated-as-default) target, +250 / +500 quick adds, exact amount, undo. */
export function WaterCard({
  waterMl,
  targetMl,
  targetIsDefault,
  disabled,
  onSet,
}: {
  waterMl: number;
  targetMl: number;
  targetIsDefault: boolean;
  disabled: boolean;
  /** Absolute total for the day (ml). */
  onSet: (totalMl: number) => void;
}) {
  const [custom, setCustom] = React.useState('');
  const done = waterMl >= targetMl;
  const customMl = Math.round(Number(custom));
  return (
    <SectionCard title="Water" subtitle={`${fmtNum(waterMl)} of ${fmtNum(targetMl)} ml${targetIsDefault ? ' (general default)' : ''}`} icon={Droplets} tone="info">
      <GrowBar value={(waterMl / targetMl) * 100} tone={done ? 'success' : 'info'} height={14} label="Water progress" />
      <p className="mt-2 text-xs text-muted-foreground">
        {done ? 'Target reached - nice work.' : `${fmtNum(targetMl - waterMl)} ml to go.`}
        {targetIsDefault ? ' Your plan has no water target, so this uses a general 2,000 ml a day.' : ''}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[250, 500].map((n) => (
          <PressButton
            key={n}
            disabled={disabled}
            onClick={() => onSet(waterMl + n)}
            className="min-h-12 rounded-xl text-sm font-semibold"
            style={{ background: `linear-gradient(135deg, ${toneTint('info', 22)}, ${toneTint('primary', 16)})`, color: toneColor('info') }}
          >
            +{n} ml
          </PressButton>
        ))}
        <PressButton
          aria-label="Undo 250 ml"
          disabled={disabled || waterMl <= 0}
          onClick={() => onSet(Math.max(0, waterMl - 250))}
          className="inline-flex min-h-12 items-center justify-center gap-1 rounded-xl border bg-card text-sm font-semibold text-muted-foreground hover:bg-accent"
        >
          <Minus className="size-4" aria-hidden /> 250
        </PressButton>
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (customMl > 0) {
            onSet(waterMl + customMl);
            setCustom('');
          }
        }}
      >
        <label htmlFor="water-custom" className="sr-only">
          Other amount in ml
        </label>
        <input
          id="water-custom"
          type="number"
          inputMode="numeric"
          min={1}
          max={5000}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Other amount (ml)"
          className="h-12 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <PressButton type="submit" disabled={disabled || !(customMl > 0)} className="inline-flex min-h-12 items-center gap-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm">
          <Plus className="size-4" aria-hidden /> Add
        </PressButton>
      </form>
    </SectionCard>
  );
}

/** Optional weight + note for the selected day (one save). Remount with a `key` per day so the fields follow the day. */
export function WeightNotesCard({
  weightKg,
  notes,
  disabled,
  onSave,
}: {
  weightKg: string | null;
  notes: string | null;
  disabled: boolean;
  onSave: (v: { weightKg?: number; notes?: string }) => void;
}) {
  const [weight, setWeight] = React.useState(weightKg ?? '');
  const [note, setNote] = React.useState(notes ?? '');
  const w = Number(weight);
  const weightChanged = weight !== '' && weight !== (weightKg ?? '') && w > 0 && w <= 500;
  const noteChanged = note !== (notes ?? '');
  return (
    <SectionCard title="Weight and notes" subtitle="Optional" icon={Scale} tone="violet">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...(weightChanged ? { weightKg: w } : {}), ...(noteChanged ? { notes: note.trim() } : {}) });
        }}
      >
        <div>
          <label htmlFor="diet-weight" className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Scale className="size-3.5" aria-hidden /> Weight (kg)
          </label>
          <input
            id="diet-weight"
            type="number"
            inputMode="decimal"
            min={0}
            max={500}
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="e.g. 72.4"
            className="h-12 w-full rounded-xl border bg-background px-3 text-base font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div>
          <label htmlFor="diet-notes" className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <NotebookPen className="size-3.5" aria-hidden /> Note
          </label>
          <textarea
            id="diet-notes"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How did eating go today?"
            className="w-full resize-none rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <PressButton type="submit" disabled={disabled || (!weightChanged && !noteChanged)} className="min-h-12 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
          Save
        </PressButton>
      </form>
    </SectionCard>
  );
}
