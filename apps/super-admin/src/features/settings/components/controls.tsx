'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FIELD } from '@/features/shell/components/page-kit';
import { cn } from '@/lib/utils';

/** Accessible on/off switch (role="switch"). */
export function ToggleSwitch({ id, checked, onChange, disabled, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span aria-hidden className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}

/**
 * Write-only secret input. A stored secret is never shown: it renders as `savedLabel` with a "Replace" button, which
 * swaps in an empty password input (with a show/hide eye). `value` is only what the user typed ('' = keep stored).
 */
export function SecretField({
  id, hasStored, savedLabel, value, onChange, disabled, placeholder,
}: {
  id: string;
  hasStored: boolean;
  savedLabel: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [replacing, setReplacing] = React.useState(false);
  const [reveal, setReveal] = React.useState(false);

  if (hasStored && !replacing) {
    return (
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate rounded-[9px] border border-dashed border-input bg-muted/40 px-2.5 py-2 text-[13px] text-muted-foreground">{savedLabel}</span>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => setReplacing(true)} aria-label={`Replace ${id}`}>Replace</Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <input
          id={id}
          type={reveal ? 'text' : 'password'}
          autoComplete="new-password"
          spellCheck={false}
          className={cn(FIELD, 'pr-9')}
          placeholder={placeholder ?? (hasStored ? 'Enter the new value' : 'Not set')}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          aria-label={reveal ? 'Hide value' : 'Show value'}
          onClick={() => setReveal((r) => !r)}
          className="absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {reveal ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
      {hasStored ? (
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => { onChange(''); setReveal(false); setReplacing(false); }}>Cancel</Button>
      ) : null}
    </div>
  );
}
