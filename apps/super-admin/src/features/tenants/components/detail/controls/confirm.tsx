'use client';

import { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ConfirmCfg {
  title: string;
  text: React.ReactNode;
  label: string;
  destructive?: boolean;
  /** Require typing the tenant slug. */
  slug?: boolean;
  reason?: boolean;
  pending: boolean;
  run: (reason: string) => void;
}

/** Inline confirmation row (NO modal): optional reason + typed-slug gate, Confirm / Cancel. */
export function InlineConfirm({ cfg, slug, onCancel }: { cfg: ConfirmCfg; slug: string; onCancel: () => void }) {
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const id = useId();
  const armed = !cfg.slug || typed.trim() === slug;
  return (
    <div role="group" aria-label={cfg.title} className={cn('space-y-2.5 rounded-lg border p-3 text-sm', cfg.destructive ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10' : 'bg-muted/50')}>
      <p className="font-semibold">{cfg.title}</p>
      <p className="text-muted-foreground">{cfg.text}</p>
      {cfg.reason ? <Input placeholder="Reason (optional)" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" /> : null}
      {cfg.slug ? (
        <div className="space-y-1">
          <label htmlFor={id} className="block text-xs text-muted-foreground">Type <code className="rounded bg-card px-1 font-mono text-foreground">{slug}</code> to confirm</label>
          <Input id={id} className="font-mono" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={cfg.destructive ? 'destructive' : 'default'} disabled={!armed || cfg.pending} onClick={() => cfg.run(reason.trim())}>
          {cfg.pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}{cfg.label}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={cfg.pending} onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/** Accessible toggle switch (role=switch). */
export function Switch({ checked, onChange, disabled, label, title }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; title?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative h-5 w-[34px] shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50', checked ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600')}
    >
      <span className={cn('absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform duration-150 motion-reduce:transition-none', checked && 'translate-x-3.5')} />
    </button>
  );
}

export const READONLY_TIP = 'Requires the tenants:manage permission';
