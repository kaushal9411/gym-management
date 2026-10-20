'use client';

import * as React from 'react';
import { AlertTriangle, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { CHANNELS, DISABLED_REASON_COPY } from '../../constants';
import { describeTiming } from '../../lib/automations';
import { formatWhen } from '../../lib/format';
import type { AutomationRule } from '../../types';
import { ChannelDots, CommsSwitch, TonePill } from '../common';

/** One automation card (design `.auto`): title + description, switch, channel dots, kind badge, activity footer, Edit. */
export function RuleCard({
  rule,
  canManage,
  toggling,
  onToggle,
  onEdit,
}: {
  rule: AutomationRule;
  canManage: boolean;
  toggling: boolean;
  onToggle: (next: boolean) => void;
  onEdit: () => void;
}) {
  const unavailable = rule.unavailableChannels;
  const activity = !rule.enabled ? 'Off' : rule.sentLast7Days > 0 ? `Sent ${rule.sentLast7Days.toLocaleString('en-IN')} this week` : rule.lastSentAt ? `Last sent ${formatWhen(rule.lastSentAt)}` : 'Not run yet';

  return (
    <article className="flex flex-col gap-2.5 rounded-2xl border bg-card p-4 shadow-xs sm:px-5" aria-labelledby={`rule-${rule.key}`}>
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h3 id={`rule-${rule.key}`} className="text-base font-bold leading-snug">
            {rule.label}
          </h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{describeTiming(rule)}</p>
        </div>
        {toggling ? (
          <span className="grid h-11 w-12 place-items-center">
            <Spinner label={`Saving ${rule.label}`} />
          </span>
        ) : (
          <CommsSwitch label={`${rule.label} automation`} checked={rule.enabled} disabled={!canManage} onChange={onToggle} />
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <ChannelDots channels={rule.channels} all={CHANNELS.map((c) => c.channel)} />
        <TonePill tone={rule.kind === 'TRANSACTIONAL' ? 'muted' : 'warning'}>{rule.kind === 'TRANSACTIONAL' ? 'Always delivered' : 'Respects opt-out'}</TonePill>
      </div>

      {unavailable.length > 0 ? (
        <p className="flex items-start gap-1.5 rounded-lg bg-warning/15 px-2.5 py-1.5 text-xs font-medium text-warning-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {unavailable.map((u) => `${u.channel === 'WHATSAPP' ? 'WhatsApp' : u.channel === 'IN_APP' ? 'In-app' : u.channel[0] + u.channel.slice(1).toLowerCase()}: ${DISABLED_REASON_COPY[u.reason].toLowerCase()}`).join('; ')}. Those messages will be skipped.
          </span>
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2.5 text-[12.5px] text-muted-foreground">
        <span>{activity}</span>
        <Button type="button" variant="ghost" size="sm" className="min-h-11 text-primary sm:min-h-9" onClick={onEdit} aria-label={`${canManage ? 'Edit' : 'View'} ${rule.label}`}>
          <Pencil className="size-3.5" aria-hidden /> {canManage ? 'Edit' : 'View'}
        </Button>
      </div>
    </article>
  );
}
