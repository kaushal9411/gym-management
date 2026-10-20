'use client';

import * as React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CAMPAIGN_STATUS_META, CHANNEL_META, RECIPIENT_STATUS_META } from '../constants';
import type { CampaignStatus, Channel, RecipientStatus } from '../types';

/** Colour dot for a channel (fixed identity colours from globals.css tokens). Decorative: always pair with a text label elsewhere. */
export function ChannelDot({ channel, size = 'md', dim }: { channel: Channel; size?: 'sm' | 'md' | 'lg'; dim?: boolean }) {
  const meta = CHANNEL_META[channel];
  return (
    <span
      aria-hidden
      title={meta.label}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-[10px] font-extrabold text-white',
        size === 'sm' && 'size-[22px] rounded-[7px] text-[11px]',
        size === 'md' && 'size-7 text-xs',
        size === 'lg' && 'size-[30px] text-[13px]',
        dim && 'opacity-25',
      )}
      style={{ backgroundColor: meta.color }}
    >
      {meta.glyph}
    </span>
  );
}

/** Row of channel dots; `all` shows every channel with the unused ones dimmed (automation cards), otherwise only the used ones. */
export function ChannelDots({ channels, all }: { channels: Channel[]; all?: Channel[] }) {
  const list = all ?? channels;
  return (
    <span className="inline-flex gap-1" role="img" aria-label={`Channels: ${channels.map((c) => CHANNEL_META[c].label).join(', ') || 'none'}`}>
      {list.map((c) => (
        <ChannelDot key={c} channel={c} size="sm" dim={all ? !channels.includes(c) : false} />
      ))}
    </span>
  );
}

type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'muted';

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/18 text-warning-foreground',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-primary/10 text-primary',
  muted: 'bg-muted text-muted-foreground',
};

export function TonePill({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold', TONE_CLASS[tone], className)}>{children}</span>;
}

export function CampaignStatusPill({ status, failed }: { status: CampaignStatus; failed?: number }) {
  const meta = CAMPAIGN_STATUS_META[status];
  // The design surfaces "2 failed" on a partly-failed row instead of a generic label.
  const label = status === 'PARTIAL' && failed ? `${failed.toLocaleString('en-IN')} failed` : meta.label;
  return <TonePill tone={meta.tone}>{label}</TonePill>;
}

export function RecipientStatusPill({ status }: { status: RecipientStatus }) {
  const meta = RECIPIENT_STATUS_META[status];
  return <TonePill tone={meta.tone}>{meta.label}</TonePill>;
}

const BANNER_STYLE = {
  error: { cls: 'border-destructive/30 bg-destructive/8 text-destructive', Icon: AlertCircle },
  warning: { cls: 'border-warning/40 bg-warning/12 text-warning-foreground', Icon: AlertTriangle },
  info: { cls: 'border-primary/25 bg-primary/6 text-foreground', Icon: Info },
  success: { cls: 'border-success/30 bg-success/8 text-success', Icon: CheckCircle2 },
} as const;

/** Inline message banner. `error` and `warning` use role=alert so assistive tech announces them. */
export function Banner({
  tone = 'error',
  title,
  children,
  action,
  className,
  id,
}: {
  tone?: keyof typeof BANNER_STYLE;
  title?: string;
  children?: React.ReactNode;
  action?: { label: string; onClick: () => void; busy?: boolean };
  className?: string;
  id?: string;
}) {
  const { cls, Icon } = BANNER_STYLE[tone];
  return (
    <div id={id} role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm', cls, className)}>
      <Icon className="mt-0.5 size-4.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-[13px] leading-relaxed">{children}</div> : null}
      </div>
      {action ? (
        <Button type="button" size="sm" variant="outline" className="shrink-0 bg-background text-foreground" disabled={action.busy} onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

/** Accessible on/off switch (button role=switch) with a 44px hit area. */
export function CommsSwitch({ checked, onChange, label, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group relative inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-full focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={cn('relative h-[26px] w-11 rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background', checked ? 'bg-success' : 'bg-border')}>
        <span className={cn('absolute left-[3px] top-[3px] size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-[18px]')} />
      </span>
    </button>
  );
}

/** Small uppercase label used for card eyebrows. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground', className)}>{children}</div>;
}

/** Inline field error: pair with `aria-describedby={id}` on the input. */
export function FieldError({ id, children }: { id: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-destructive">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
