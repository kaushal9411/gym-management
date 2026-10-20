'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/** Toggle chip (design `.chip`): `aria-pressed` carries state; 44px tall on touch, compact on desktop. */
export const Chip = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean }>(
  ({ pressed, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={pressed}
      className={cn(
        'inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] font-semibold transition-[transform,background-color] duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-9',
        pressed ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/50 text-foreground hover:bg-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
Chip.displayName = 'Chip';

/** A labelled group of chips (design `.grp`). */
export function ChipGroup({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  const id = React.useId();
  return (
    <div role="group" aria-labelledby={id} className="mb-4">
      <div id={id} className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
      {hint ? <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

/** Numeric input with its own text state so typing never snaps; commits only valid integers within range. */
export function BoundedNumberInput({
  id,
  label,
  value,
  min,
  max,
  onCommit,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (n: number) => void;
  suffix: string;
}) {
  const [text, setText] = React.useState(String(value));
  const parsed = Number(text);
  const valid = /^\d+$/.test(text) && parsed >= min && parsed <= max;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={text}
        aria-invalid={!valid}
        aria-describedby={`${id}-hint`}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, '').slice(0, 3);
          setText(t);
          const n = Number(t);
          if (/^\d+$/.test(t) && n >= min && n <= max) onCommit(n);
        }}
        onBlur={() => {
          if (!valid) setText(String(value));
        }}
        className="h-11 w-20 rounded-lg border border-input bg-background px-3 text-sm tabular-nums aria-invalid:border-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:h-9"
      />
      <span className="text-[13px] text-muted-foreground">{suffix}</span>
      <span id={`${id}-hint`} className={cn('text-xs', valid ? 'text-muted-foreground' : 'font-medium text-destructive')} role={valid ? undefined : 'alert'}>
        {valid ? `${min} to ${max}` : `Enter a whole number from ${min} to ${max}.`}
      </span>
    </div>
  );
}
