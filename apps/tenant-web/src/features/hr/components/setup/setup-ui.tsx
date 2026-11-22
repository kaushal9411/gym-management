'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { cn } from '@/lib/utils';

/** Two-step inline delete: the trash button swaps for "Remove? Yes / No" in place (no modal, no window.confirm). */
export function InlineDelete({ label, onConfirm, pending, disabled }: { label: string; onConfirm: () => void | Promise<void>; pending?: boolean; disabled?: boolean }) {
  const [asking, setAsking] = React.useState(false);
  if (!asking)
    return (
      <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Delete ${label}`} disabled={disabled} onClick={() => setAsking(true)}>
        <Trash2 className="size-4 text-destructive" />
      </Button>
    );
  return (
    <span role="group" aria-label={`Confirm delete ${label}`} className="inline-flex items-center gap-1.5 text-xs font-semibold">
      Remove?
      <LoadingButton type="button" size="sm" variant="destructive" className="h-7 px-2.5" loading={pending} onClick={() => void onConfirm()}>
        Yes
      </LoadingButton>
      <Button type="button" size="sm" variant="ghost" className="h-7 px-2.5" onClick={() => setAsking(false)}>
        No
      </Button>
    </span>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50', checked ? 'bg-[color:var(--success)]' : 'bg-muted-foreground/30')}
    >
      <span className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}

export function SwitchRow({ title, hint, checked, onChange, disabled }: { title: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[13.5px] font-bold">{title}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}
