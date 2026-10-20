'use client';

import * as React from 'react';
import { MoonStar } from 'lucide-react';

import { cn } from '@/lib/utils';
import { CHANNELS, DISABLED_REASON_COPY, QUIET_CHANNELS } from '../../constants';
import { localTimezoneLabel, toLocalInputValue } from '../../lib/message';
import { defaultScheduleValue, type ComposerState } from '../../lib/composer';
import type { AudiencePreview, Channel, ChannelQuotaOverview, DisabledReason } from '../../types';
import { CommsSwitch, FieldError } from '../common';
import { ChannelDot } from '../common';
import { StepCard } from './step-card';

export interface ChannelState {
  channel: Channel;
  /** Channel cannot be used at all right now. */
  disabledReason: DisabledReason;
  limited: boolean;
  remaining: number | null;
  /** Selected and the audience would exceed the remaining quota. */
  short: boolean;
  shortBy: number;
}

/** Merges the hub overview (limits for every channel) with the live preview (over/short for the current audience). */
export function channelStates(overview: ChannelQuotaOverview[] | undefined, preview: AudiencePreview | undefined, selected: Channel[]): Record<Channel, ChannelState> {
  const out = {} as Record<Channel, ChannelState>;
  for (const { channel } of CHANNELS) {
    const o = overview?.find((c) => c.channel === channel);
    const p = preview?.channels.find((c) => c.channel === channel);
    const quota = p?.quota;
    const disabledReason = quota ? (quota.enabled ? null : quota.disabledReason ?? 'disabled_tenant') : o && !o.enabled ? o.disabledReason ?? 'disabled_tenant' : null;
    const limit = quota?.limit ?? o?.limit ?? null;
    const remaining = quota ? quota.remaining : (o?.remaining ?? null);
    out[channel] = {
      channel,
      disabledReason,
      limited: limit !== null,
      remaining,
      short: selected.includes(channel) && !!quota && quota.enabled && quota.over,
      shortBy: quota?.shortBy ?? 0,
    };
  }
  return out;
}

/** Step 3: channel buttons with live limit state, quiet-hours and schedule options. */
export function ChannelsStep({
  state,
  states,
  onToggle,
  onPatch,
  channelError,
  scheduleError,
  scheduleLocked,
  disabled,
}: {
  state: ComposerState;
  states: Record<Channel, ChannelState>;
  onToggle: (c: Channel) => void;
  onPatch: (patch: Partial<ComposerState>) => void;
  channelError?: string;
  scheduleError?: string;
  /** Editing a saved draft: the API cannot turn a draft into a scheduled send. */
  scheduleLocked?: string;
  disabled?: boolean;
}) {
  const quietRelevant = state.channels.some((c) => QUIET_CHANNELS.includes(c));
  const [nowMin, nowMax] = React.useMemo(() => {
    const t = Date.now();
    return [toLocalInputValue(new Date(t + 60_000)), toLocalInputValue(new Date(t + 90 * 86_400_000))];
  }, []);

  return (
    <StepCard n={3} id="step-channels" title="Where should it go?" sub="Each recipient uses one message from that channel's monthly limit.">
      <div role="group" aria-label="Channels" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {CHANNELS.map((c) => {
          const s = states[c.channel];
          const on = state.channels.includes(c.channel);
          const unavailable = !!s.disabledReason;
          const blocked = unavailable && !on;
          const sub = unavailable
            ? on
              ? 'Not available: turn off'
              : DISABLED_REASON_COPY[s.disabledReason as 'disabled_platform' | 'disabled_tenant']
            : s.short
              ? `Short by ${s.shortBy.toLocaleString('en-IN')}`
              : s.limited
                ? `${(s.remaining ?? 0).toLocaleString('en-IN')} left`
                : 'No limit';
          const bad = s.short || (unavailable && on);
          return (
            <button
              key={c.channel}
              type="button"
              aria-pressed={on}
              disabled={disabled || blocked}
              aria-describedby={`ch-${c.channel}-sub`}
              onClick={() => onToggle(c.channel)}
              style={{ ['--c' as string]: c.color }}
              className={cn(
                'relative flex min-h-[88px] flex-col items-center gap-0.5 rounded-[14px] border-[1.5px] bg-muted/40 px-2 py-3 text-center transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-55',
                on && !bad && 'border-[var(--c)] bg-[color-mix(in_srgb,var(--c)_10%,var(--card))]',
                bad && 'border-destructive',
                !on && !bad && 'border-border',
              )}
            >
              <ChannelDot channel={c.channel} size="lg" />
              <b className="text-[13px]">{c.label}</b>
              <small id={`ch-${c.channel}-sub`} className={cn('text-[11.5px] tabular-nums', bad ? 'font-bold text-destructive' : 'text-muted-foreground')}>
                {sub}
              </small>
            </button>
          );
        })}
      </div>
      <FieldError id="ch-err">{channelError}</FieldError>

      <div className="mt-3 flex flex-wrap gap-2.5">
        <div className="flex items-center gap-2 rounded-xl border bg-muted/40 py-1 pl-2 pr-3.5 text-sm font-semibold">
          <CommsSwitch label="Hold SMS and WhatsApp during quiet hours" checked={state.holdQuietHours} onChange={(v) => onPatch({ holdQuietHours: v })} disabled={disabled} />
          <span>Hold SMS and WhatsApp until 8 am if sent after 9 pm</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-muted/40 py-1 pl-2 pr-3.5 text-sm font-semibold">
          <CommsSwitch
            label="Schedule for later"
            checked={state.scheduleOn}
            disabled={disabled || !!scheduleLocked}
            onChange={(v) => onPatch({ scheduleOn: v, scheduledAt: v && !state.scheduledAt ? defaultScheduleValue() : state.scheduledAt })}
          />
          <span>Schedule for later</span>
        </div>
      </div>
      {scheduleLocked ? <p className="mt-2 text-xs text-muted-foreground">{scheduleLocked}</p> : null}

      {quietRelevant ? (
        <p className="mt-2.5 flex items-start gap-2 text-[13px] text-muted-foreground">
          <MoonStar className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {state.holdQuietHours
              ? "SMS and WhatsApp are never sent between 9 pm and 8 am in each member's branch time zone. Held messages go out at 8 am."
              : 'Quiet hours are off for this message: SMS and WhatsApp can reach members late at night.'}
          </span>
        </p>
      ) : null}

      {state.scheduleOn ? (
        <div className="mt-3 flex max-w-sm flex-col gap-1.5">
          <label htmlFor="cm-schedule" className="text-[13px] font-semibold">
            Send on
          </label>
          <input
            id="cm-schedule"
            type="datetime-local"
            value={state.scheduledAt}
            min={nowMin}
            max={nowMax}
            disabled={disabled}
            aria-invalid={!!scheduleError}
            aria-describedby={`cm-schedule-hint${scheduleError ? ' cm-schedule-err' : ''}`}
            onChange={(e) => onPatch({ scheduledAt: e.target.value })}
            className="h-11 w-full rounded-[10px] border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive sm:h-10"
          />
          <p id="cm-schedule-hint" className="text-xs text-muted-foreground">
            Your time ({localTimezoneLabel()}). Between a minute from now and 90 days ahead. Members are picked again when it sends.
          </p>
          <FieldError id="cm-schedule-err">{scheduleError}</FieldError>
        </div>
      ) : null}
    </StepCard>
  );
}
