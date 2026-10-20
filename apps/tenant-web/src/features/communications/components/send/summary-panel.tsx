'use client';

import * as React from 'react';
import { Users } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CHANNEL_META } from '../../constants';
import { describeLoadError } from '../../lib/errors';
import { renderPreview } from '../../lib/message';
import type { ComposerState } from '../../lib/composer';
import type { AudiencePreview, Channel } from '../../types';
import { Banner, ChannelDot, Eyebrow } from '../common';
import type { ChannelState } from './channels-step';

const fmt = (n: number) => n.toLocaleString('en-IN');

export interface PreviewStatus {
  data: AudiencePreview | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  /** A newer request is pending (debounce or fetch in flight): the number shown may lag. */
  stale: boolean;
}

function countSub(state: ComposerState, activeFilters: number): string {
  if (state.mode === 'PICKED') return 'members you picked';
  return activeFilters > 0 ? 'match your filters' : 'active members';
}

/** Right-hand sticky "Recipients" card: live count (aria-live), sample names, sizes and warnings. */
export function RecipientsCard({ state, preview, filterCount }: { state: ComposerState; preview: PreviewStatus; filterCount: number }) {
  const { data } = preview;
  const none = state.mode === 'PICKED' && Object.keys(state.picked).length === 0;
  const total = none ? 0 : (data?.total ?? 0);

  let sample = '';
  if (none) sample = 'Nobody picked yet. Tick members in the list.';
  else if (data) {
    const names = data.sample.slice(0, 4).map((s) => s.name);
    sample = data.total === 0 ? (state.mode === 'PICKED' ? 'Nobody picked yet.' : 'No members match. Remove a filter.') : names.join(', ') + (data.total > names.length ? ` and ${fmt(data.total - names.length)} more` : '');
  }

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-xs sm:px-5">
      <Eyebrow>Recipients</Eyebrow>
      {preview.isError && !none ? (
        <Banner className="mt-2" title="Couldn't count recipients" action={{ label: 'Try again', onClick: preview.refetch }}>
          {describeLoadError(preview.error, 'the audience')}
        </Banner>
      ) : (
        <>
          <div className="mt-1 flex items-center gap-2">
            {preview.isLoading && !none ? (
              <Skeleton className="h-12 w-28" />
            ) : (
              <div aria-hidden className={cn('text-5xl font-extrabold leading-none tabular-nums transition-opacity', preview.stale && 'opacity-60')}>
                {fmt(total)}
              </div>
            )}
            <Users className="size-5 text-muted-foreground" aria-hidden />
          </div>
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {preview.isLoading && !none ? 'Counting recipients' : `${fmt(total)} ${total === 1 ? 'recipient' : 'recipients'}`}
          </div>
          <div className="text-sm text-muted-foreground">{countSub(state, filterCount)}</div>
          {sample ? <p className="mt-2.5 text-[13px] text-muted-foreground">{sample}</p> : null}
          {data?.exceedsMax ? (
            <p role="alert" className="mt-2 rounded-lg bg-destructive/10 px-2.5 py-2 text-[12.5px] font-semibold text-destructive">
              That is more than {fmt(data.maxRecipients)} members, the most one message can reach. Narrow the audience.
            </p>
          ) : data?.largeSend && !none ? (
            <p className="mt-2 rounded-lg bg-warning/15 px-2.5 py-2 text-[12.5px] font-semibold text-warning-foreground">
              More than {fmt(data.largeSendThreshold)} members, so you will be asked to confirm before it goes out.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

/** "Uses this month" meters for each selected channel plus reach / opt-out detail. */
export function UsageCard({ state, preview, states }: { state: ComposerState; preview: PreviewStatus; states: Record<Channel, ChannelState> }) {
  const selected = state.channels;
  const rows = selected.map((channel) => {
    const p = preview.data?.channels.find((c) => c.channel === channel);
    return { channel, p, s: states[channel] };
  });
  const problems = rows.filter((r) => r.s.short || r.s.disabledReason);
  const names = (list: typeof rows) => list.map((r) => CHANNEL_META[r.channel].label).join(' and ');

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-xs sm:px-5">
      <Eyebrow className="mb-2.5">Uses this month</Eyebrow>
      {selected.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Pick at least one channel.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ channel, p, s }) => {
            const use = p?.willReceive ?? 0;
            const over = s.short || !!s.disabledReason;
            const remaining = p?.quota.remaining ?? s.remaining;
            const limited = s.limited;
            const pct = !limited ? 8 : remaining ? Math.min(100, (use / Math.max(remaining, 1)) * 100) : use > 0 ? 100 : 0;
            const meta = CHANNEL_META[channel];
            return (
              <li key={channel}>
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="inline-flex items-center gap-2 font-bold">
                    <ChannelDot channel={channel} size="sm" />
                    {meta.label}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {!preview.data ? '…' : s.disabledReason ? 'not available' : limited ? `${fmt(use)} of ${fmt(remaining ?? 0)} left` : `${fmt(use)} sent, no limit`}
                  </span>
                </div>
                <div
                  className="mt-1 h-[7px] overflow-hidden rounded-full bg-border"
                  role="progressbar"
                  aria-label={`${meta.label}: this message would use ${fmt(use)}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(pct)}
                >
                  <i className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: over ? 'var(--destructive)' : meta.color }} />
                </div>
                {p && (p.optedOut > 0 || p.contactable < (preview.data?.total ?? 0)) ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fmt(p.contactable)} can be reached{p.optedOut > 0 ? `, ${fmt(p.optedOut)} opted out of promotions` : ''}.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {problems.length ? (
        <p role="alert" className="mt-3 rounded-[10px] bg-destructive/10 px-2.5 py-2 text-[12.5px] font-semibold text-destructive">
          {problems.some((r) => r.s.disabledReason)
            ? `${names(problems.filter((r) => r.s.disabledReason))} ${problems.filter((r) => r.s.disabledReason).length === 1 ? 'is' : 'are'} not available for your gym. Turn ${problems.filter((r) => r.s.disabledReason).length === 1 ? 'it' : 'them'} off to send. `
            : ''}
          {problems.some((r) => r.s.short) ? `${names(problems.filter((r) => r.s.short))} would go over this month's limit. Turn it off or narrow the audience.` : ''}
        </p>
      ) : null}
    </div>
  );
}

/** The phone-style preview bubble, filled with sample member values. */
export function PreviewBubble({ title, body, gymName }: { title: string; body: string; gymName: string }) {
  return (
    <div className="rounded-[20px] bg-[#14172b] p-3.5 dark:bg-black/40" aria-label="Message preview">
      <div className="rounded-[14px] bg-card p-3 text-card-foreground shadow-md">
        <small className="flex justify-between text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          <span>{gymName}</span>
          <span>now</span>
        </small>
        <b className="my-0.5 block break-words">{renderPreview(title) || 'Your title appears here'}</b>
        <p className="break-words text-[13px] text-muted-foreground">{renderPreview(body) || 'Your message appears here.'}</p>
      </div>
      <p className="mt-2 px-1 text-[11px] text-white/60">Preview with a sample member (Aarav Kapoor).</p>
    </div>
  );
}
