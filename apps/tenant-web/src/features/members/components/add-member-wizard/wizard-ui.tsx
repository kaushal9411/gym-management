'use client';

import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { type Accent, accentVar, tint } from '../detail/detail-ui';

interface ChipSelectProps<T extends string> {
  value: T | '';
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T | '') => void;
  accent?: Accent;
  disabled?: boolean;
  /** Clicking the selected chip clears it — every field these back is optional. */
  clearable?: boolean;
  label: string;
}

/** Single-choice pill group, used wherever the old form had a native `<select>` with ≤ 9 options. */
export function ChipSelect<T extends string>({ value, options, onChange, accent = 'primary', disabled, clearable = true, label }: ChipSelectProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([v, text]) => {
        const on = value === v;
        return (
          <motion.button
            key={v}
            type="button"
            whileTap={{ scale: 0.95 }}
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(on && clearable ? '' : v)}
            className={cn('rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all hover:-translate-y-px disabled:opacity-50')}
            style={on ? { backgroundColor: accentVar(accent), color: '#fff', borderColor: accentVar(accent), boxShadow: `0 10px 20px -12px ${accentVar(accent)}` } : undefined}
          >
            {text}
          </motion.button>
        );
      })}
    </div>
  );
}

interface YesNoProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function YesNoToggle({ value, onChange, label, disabled }: YesNoProps) {
  return (
    <div role="group" aria-label={label} className="inline-flex shrink-0 rounded-xl border bg-muted/50 p-0.5">
      {([false, true] as const).map((v) => (
        <button
          key={String(v)}
          type="button"
          disabled={disabled}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn('rounded-[10px] px-4 py-1.5 text-[13px] font-bold transition-all', value === v ? 'text-white shadow-md' : 'text-muted-foreground')}
          style={value === v ? { backgroundColor: v ? 'var(--destructive)' : 'var(--success)' } : undefined}
        >
          {v ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  );
}

export function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-semibold">{label}</p>
      {children}
    </div>
  );
}

export function Notice({ tone, children }: { tone: Accent; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-2xl border p-3.5 text-sm" style={{ backgroundColor: tint(tone, 10), borderColor: tint(tone, 30) }}>
      {children}
    </div>
  );
}
