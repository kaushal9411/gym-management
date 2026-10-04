'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Label + control + inline error/hint. Error is announced via `role="alert"`. */
export function Field({ id, label, error, hint, className, children }: { id: string; label: string; error?: string; hint?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** 44px, 16px-text input (no iOS zoom on focus). */
export const FieldInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input> & { invalid?: boolean }>(function FieldInput({ className, invalid, id, ...props }, ref) {
  return <Input ref={ref} id={id} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined} className={cn('h-11 text-base md:text-sm', invalid && 'border-destructive', className)} {...props} />;
});

/** Single-choice chips; tapping the selected chip clears it (optional fields). */
export function ChipSelect<T extends string>({ label, value, options, onChange, disabled, error }: { label: string; value: string; options: Array<[T, string]>; onChange: (v: T | '') => void; disabled?: boolean; error?: string }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-sm font-medium leading-none">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2 pt-1">
        {options.map(([key, text]) => {
          const on = value === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange(on ? '' : key)}
              className={cn(
                'min-h-11 rounded-full border px-4 text-sm font-medium transition active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50',
                on ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'bg-background text-foreground hover:bg-muted',
              )}
            >
              {text}
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
