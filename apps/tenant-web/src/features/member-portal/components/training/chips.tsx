'use client';

import { cn } from '@/lib/utils';

/** Horizontally wrapping filter chips (>=44px tall tap targets). */
export function FilterChips<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-11 rounded-full border px-4 text-sm font-medium transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === o.value ? 'border-transparent bg-primary text-primary-foreground shadow-sm' : 'bg-card text-muted-foreground hover:bg-accent',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
