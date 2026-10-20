'use client';

import * as React from 'react';
import { FlaskConical, Save } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Spinner } from '@/components/ui/spinner';
import { CHANNEL_META, COMMUNICATIONS_ROUTES } from '../../constants';
import type { CommsError } from '../../lib/errors';
import type { TestSendResult } from '../../types';
import { Banner, ChannelDot, TonePill } from '../common';
import type { Busy } from '../../hooks/use-send-flow';

const TITLES: Partial<Record<CommsError['kind'], string>> = {
  network: 'No connection',
  quota: "Over this month's limit",
  'channel-disabled': 'A channel is not available',
  'rate-limit': 'Slow down a little',
  forbidden: "You can't do that",
  'not-found': 'Something was removed',
  conflict: 'This message changed',
  server: 'Something went wrong',
  validation: 'Please fix the highlighted fields',
  'audience-empty': 'Nobody to send to',
  'recipient-limit': 'Audience is too large',
  unknown: 'Could not complete that',
};

/** Banner for every non-field failure of a send / save / test action, with a retry where retrying makes sense. */
export function SendErrorBanner({ error, onRetry, retrying }: { error: CommsError; onRetry: () => void; retrying: boolean }) {
  const retryable = error.kind === 'network' || error.kind === 'server';
  return (
    <Banner tone="error" title={TITLES[error.kind] ?? 'Could not complete that'} action={retryable ? { label: 'Try again', onClick: onRetry, busy: retrying } : undefined}>
      <p>{error.message}</p>
      {error.extra.length ? (
        <ul className="mt-1 list-disc pl-4">
          {error.extra.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {error.kind === 'conflict' ? (
        <p className="mt-1">
          <Link href={COMMUNICATIONS_ROUTES.history} className="font-semibold underline underline-offset-2">
            Open History
          </Link>{' '}
          to see its current state.
        </p>
      ) : null}
    </Banner>
  );
}

export function TestResults({ result }: { result: TestSendResult }) {
  return (
    <div className="rounded-xl border bg-muted/40 p-3 text-[13px]" role="status">
      <p className="mb-1.5 font-semibold">Test result</p>
      <ul className="space-y-1.5">
        {result.results.map((r) => (
          <li key={r.channel} className="flex items-start gap-2">
            <ChannelDot channel={r.channel} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{CHANNEL_META[r.channel].label}</span>
              <span className="block break-words text-muted-foreground">{r.message}</span>
            </span>
            <TonePill tone={r.status === 'QUEUED' ? 'success' : r.status === 'SKIPPED' ? 'warning' : 'destructive'}>{r.status === 'QUEUED' ? 'Queued' : r.status === 'SKIPPED' ? 'Skipped' : 'Failed'}</TonePill>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Send / Save draft / Test buttons. Structural blockers disable Send and are explained underneath; text errors show on click. */
export function SendActions({
  label,
  busy,
  blocker,
  onSend,
  onDraft,
  onTest,
  canDraft,
}: {
  label: string;
  busy: Busy;
  /** Why Send is disabled right now (null = enabled). */
  blocker: string | null;
  onSend: () => void;
  onDraft: () => void;
  onTest: () => void;
  canDraft: boolean;
}) {
  const disabledAll = busy !== null;
  return (
    <div className="flex flex-col gap-2.5">
      <LoadingButton type="button" size="lg" className="min-h-12 w-full text-[15px] font-bold" loading={busy === 'send'} loadingText="Sending…" disabled={disabledAll || !!blocker} aria-describedby={blocker ? 'send-blocker' : undefined} onClick={onSend}>
        {label}
      </LoadingButton>
      {blocker ? (
        <p id="send-blocker" className="-mt-1 text-center text-xs text-muted-foreground">
          {blocker}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2.5">
        <Button type="button" variant="outline" className="min-h-11" disabled={disabledAll || !canDraft} onClick={onDraft}>
          {busy === 'draft' ? <Spinner label="Saving draft" /> : <Save className="size-4" aria-hidden />}
          Save draft
        </Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={disabledAll} onClick={onTest}>
          {busy === 'test' ? <Spinner label="Sending test" /> : <FlaskConical className="size-4" aria-hidden />}
          Test to me
        </Button>
      </div>
    </div>
  );
}
