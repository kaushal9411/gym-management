'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { toTenantError } from '@/features/tenants/hooks/use-tenants';
import {
  useSaveNotificationChannel,
  useTenantNotificationChannels,
  type NotificationChannel,
  type NotificationChannelRow,
} from '@/features/tenants/api/detail';
import { cn } from '@/lib/utils';
import { READONLY_TIP, Switch } from './confirm';

const LABEL: Record<NotificationChannel, string> = { EMAIL: 'Email', SMS: 'SMS', WHATSAPP: 'WhatsApp' };

const parse = (s: string): number | null | 'bad' => {
  const t = s.trim();
  if (t === '') return null;
  if (!/^\d+$/.test(t)) return 'bad';
  const n = Number(t);
  return n > 1_000_000 ? 'bad' : n;
};

/**
 * Super-admin ceiling for the 3 paid send channels (Email/SMS/WhatsApp — IN_APP/PUSH are free/platform-configured
 * and never shown here). Each row is independent: flipping the switch saves immediately; the quota input saves on
 * blur/Enter alongside the row's current enabled state, same per-row-immediate-save shape as `ModulesEditor`
 * rather than `LimitsEditor`'s batched multi-row save (there's no shared "apply to all" action here to batch for).
 */
export function NotificationChannelsEditor({ tenantId, canManage }: { tenantId: string; canManage: boolean }) {
  const q = useTenantNotificationChannels(tenantId);
  const save = useSaveNotificationChannel(tenantId);
  const [draft, setDraft] = useState<Record<string, string>>({});

  if (q.isLoading) return <div className="h-40 animate-pulse rounded-lg bg-muted" aria-busy="true" />;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">Could not load notification channels.</p>;

  const current = (r: NotificationChannelRow) => draft[r.channel] ?? (r.monthlyLimit === null ? '' : String(r.monthlyLimit));

  const submit = async (r: NotificationChannelRow, enabled: boolean, monthlyLimit: number | null, msg: string) => {
    const id = toast.loading(`Saving ${LABEL[r.channel]}…`);
    try {
      await save.mutateAsync({ channel: r.channel, enabled, monthlyLimit });
      setDraft((d) => { const next = { ...d }; delete next[r.channel]; return next; });
      toast.success(msg, { id });
    } catch (e) { toast.error(toTenantError(e).message, { id }); }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_84px_90px] items-center gap-x-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Channel</span><span>Monthly quota</span><span className="text-right">Used this month</span>
      </div>
      {q.data.map((r) => {
        const val = current(r);
        const p = parse(val);
        const changed = draft[r.channel] !== undefined && p !== r.monthlyLimit;
        const pending = save.isPending && save.variables?.channel === r.channel;
        return (
          <div key={r.channel} className="grid grid-cols-[minmax(0,1fr)_84px_90px] items-center gap-x-2 rounded-lg border px-3 py-2.5">
            <span className="flex items-center gap-2.5 text-[13px]">
              <Switch
                checked={r.enabled}
                onChange={(v) => void submit(r, v, r.monthlyLimit, `${LABEL[r.channel]} ${v ? 'enabled' : 'disabled'}`)}
                disabled={!canManage || pending}
                label={`${LABEL[r.channel]} enabled`}
                title={canManage ? undefined : READONLY_TIP}
              />
              {LABEL[r.channel]}
            </span>
            <input
              inputMode="numeric"
              value={val}
              placeholder="unlimited"
              aria-label={`${LABEL[r.channel]} monthly quota`}
              aria-invalid={p === 'bad'}
              disabled={!canManage || pending}
              title={canManage ? undefined : READONLY_TIP}
              onChange={(e) => setDraft((d) => ({ ...d, [r.channel]: e.target.value }))}
              onBlur={() => { if (changed && p !== 'bad') void submit(r, r.enabled, p, `${LABEL[r.channel]} quota saved`); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && changed && p !== 'bad') void submit(r, r.enabled, p, `${LABEL[r.channel]} quota saved`); }}
              className={cn('h-8 w-full rounded-md border bg-background px-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60', p === 'bad' && 'border-destructive', changed && 'border-primary')}
            />
            <span className="flex items-center justify-end gap-1.5 text-right font-mono text-xs font-semibold">
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}{r.usedThisMonth.toLocaleString('en-IN')}
              {r.monthlyLimit !== null ? <span className="text-muted-foreground"> / {r.monthlyLimit.toLocaleString('en-IN')}</span> : null}
            </span>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">Blank quota = unlimited. A disabled channel blocks every send for this tenant regardless of quota, even if the tenant has their own toggle on.</p>
    </div>
  );
}
