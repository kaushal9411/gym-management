'use client';

import * as React from 'react';
import Link from 'next/link';
import { Ban, Pencil, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LoadingButton } from '@/components/ui/loading-button';
import { Skeleton } from '@/components/ui/skeleton';
import { CANCELLABLE_STATUSES, CHANNEL_META, COMMUNICATIONS_ROUTES, EDITABLE_STATUSES, RETRYABLE_STATUSES } from '../../constants';
import { useCampaign, useCancelCampaign, useRetryFailed } from '../../hooks/use-communications';
import { audienceLabel, type NameLookup } from '../../lib/composer';
import { classifyError, describeLoadError } from '../../lib/errors';
import { campaignWhen, fmtNum, formatFull, formatWhen } from '../../lib/format';
import type { CampaignDetail } from '../../types';
import { Banner, CampaignStatusPill, ChannelDot } from '../common';
import { RecipientList } from './recipient-list';

function Bar({ c }: { c: CampaignDetail }) {
  const total = Math.max(c.messageCount, 1);
  const parts = [
    { key: 'sent', n: c.sentCount, color: 'var(--success)' },
    { key: 'failed', n: c.failedCount, color: 'var(--destructive)' },
    { key: 'skipped', n: c.skippedCount, color: 'var(--channel-sms)' },
    { key: 'waiting', n: c.queuedCount, color: 'color-mix(in oklab, var(--primary) 45%, var(--border))' },
    { key: 'cancelled', n: c.cancelledCount, color: 'var(--muted-foreground)' },
  ];
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-border" role="img" aria-label={`${fmtNum(c.sentCount)} sent, ${fmtNum(c.failedCount)} failed, ${fmtNum(c.skippedCount)} skipped, ${fmtNum(c.queuedCount)} waiting of ${fmtNum(c.messageCount)} messages`}>
      {parts.map((p) => (p.n > 0 ? <i key={p.key} className="block h-full" style={{ width: `${(p.n / total) * 100}%`, backgroundColor: p.color }} /> : null))}
    </div>
  );
}

const SKIP_TEXT: Record<string, string> = {
  SKIPPED_OPTED_OUT: 'opted out',
  SKIPPED_NO_CONTACT: 'no contact details',
  SKIPPED_QUOTA: 'over the monthly limit',
  SKIPPED_DISABLED: 'channel switched off',
};

/** Right-hand history panel: live counts (polled while sending), per-channel breakdown, held/skipped notes and the recipient list. */
export function CampaignDetailPanel({ id, canSend, names }: { id: string; canSend: boolean; names: NameLookup }) {
  const q = useCampaign(id);
  const cancel = useCancelCampaign();
  const retry = useRetryFailed();
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  if (q.isLoading) {
    return (
      <div className="space-y-3" aria-busy aria-label="Loading message">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-2.5 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    const e = classifyError(q.error);
    return (
      <Banner title={e.kind === 'not-found' ? 'This message no longer exists' : "Couldn't load this message"} action={e.kind === 'not-found' ? undefined : { label: 'Try again', onClick: () => void q.refetch(), busy: q.isFetching }}>
        {describeLoadError(q.error, 'this message')}
      </Banner>
    );
  }
  const c = q.data;
  const canCancel = canSend && CANCELLABLE_STATUSES.includes(c.status);
  const canRetry = canSend && RETRYABLE_STATUSES.includes(c.status) && c.failedCount > 0;
  const canEdit = canSend && EDITABLE_STATUSES.includes(c.status);

  const onConflict = (message: string) => {
    toast.error(message);
    void q.refetch();
  };
  const doCancel = () =>
    cancel.mutate(c.id, {
      onSuccess: () => {
        setConfirmCancel(false);
        toast.success(c.status === 'SENDING' ? 'Cancelled. Messages already handed to a channel will still finish.' : 'Message cancelled.');
      },
      onError: (err) => {
        setConfirmCancel(false);
        const e = classifyError(err);
        if (e.kind === 'conflict') onConflict(e.apiCode === 'INVALID_STATE' ? e.message : 'This message just changed. Showing its latest state.');
        else toast.error(e.message);
      },
    });
  const doRetry = () =>
    retry.mutate(c.id, {
      onSuccess: (r) => toast.success(`${fmtNum(r.retried)} failed ${r.retried === 1 ? 'message was' : 'messages were'} queued again.`),
      onError: (err) => {
        const e = classifyError(err);
        if (e.kind === 'conflict') onConflict(e.message);
        else toast.error(e.message);
      },
    });

  const skippedParts = Object.entries(c.skippedByReason).filter(([, n]) => (n ?? 0) > 0);

  return (
    <div aria-live="polite">
      <h3 className="break-words text-lg font-bold leading-snug">{c.name || c.title}</h3>
      <p className="mt-0.5 text-[13px] text-muted-foreground">
        {audienceLabel(c, names)} · {campaignWhen(c)}
        {c.createdBy ? ` · by ${c.createdBy.name}` : ''}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <CampaignStatusPill status={c.status} />
        {c.status === 'SENDING' ? <span className="text-xs text-muted-foreground">Updating live…</span> : null}
      </div>

      <div className="mt-3 rounded-xl border bg-muted/40 p-3 text-[13px]">
        <p className="break-words font-semibold">{c.title}</p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-muted-foreground">{c.body}</p>
      </div>

      {c.failureReason ? (
        <Banner className="mt-3" title="Why it failed">
          {c.failureReason}
        </Banner>
      ) : null}
      {c.notices?.map((n) => (
        <Banner key={n} tone="info" className="mt-3">
          {n}
        </Banner>
      ))}

      <div className="mt-3.5">
        <Bar c={c} />
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
          <span><b className="text-foreground">{fmtNum(c.sentCount)}</b> sent</span>
          <span><b className="text-foreground">{fmtNum(c.failedCount)}</b> failed</span>
          <span><b className="text-foreground">{fmtNum(c.skippedCount)}</b> skipped</span>
          <span><b className="text-foreground">{fmtNum(c.queuedCount)}</b> waiting</span>
          {c.cancelledCount > 0 ? <span><b className="text-foreground">{fmtNum(c.cancelledCount)}</b> cancelled</span> : null}
        </p>
        {skippedParts.length ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Skipped: {skippedParts.map(([k, n]) => `${fmtNum(n ?? 0)} ${SKIP_TEXT[k] ?? k}`).join(', ')}.
          </p>
        ) : null}
        {c.heldCount > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {fmtNum(c.heldCount)} SMS/WhatsApp {c.heldCount === 1 ? 'message is' : 'messages are'} held for quiet hours{c.nextReleaseAt ? `, next release ${formatWhen(c.nextReleaseAt)}` : ''}.
          </p>
        ) : null}
      </div>

      {c.breakdown.length > 0 ? (
        <ul className="mt-3 space-y-1.5" aria-label="By channel">
          {c.breakdown.map((b) => (
            <li key={b.channel} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="inline-flex items-center gap-2 font-semibold">
                <ChannelDot channel={b.channel} size="sm" />
                {CHANNEL_META[b.channel].label}
              </span>
              <span className="text-xs text-muted-foreground">
                {fmtNum(b.sent)} sent{b.failed ? ` · ${fmtNum(b.failed)} failed` : ''}{b.skipped ? ` · ${fmtNum(b.skipped)} skipped` : ''}{b.queued ? ` · ${fmtNum(b.queued)} waiting` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        Created {formatFull(c.createdAt)}. Sent means the provider accepted it; delivery and read receipts are not tracked.
      </p>

      {canCancel || canRetry || canEdit ? (
        <div className="mt-3.5 flex flex-wrap gap-2">
          {canEdit ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`${COMMUNICATIONS_ROUTES.send}?edit=${c.id}`}>
                <Pencil className="size-4" aria-hidden /> Edit
              </Link>
            </Button>
          ) : null}
          {canRetry ? (
            <LoadingButton type="button" variant="outline" className="min-h-11" loading={retry.isPending} loadingText="Retrying…" onClick={doRetry}>
              <RotateCcw className="size-4" aria-hidden /> Send again to failed only
            </LoadingButton>
          ) : null}
          {canCancel ? (
            <Button type="button" variant="outline" className="min-h-11 text-destructive hover:text-destructive" disabled={cancel.isPending} onClick={() => setConfirmCancel(true)}>
              <Ban className="size-4" aria-hidden /> {c.status === 'SENDING' ? 'Cancel remaining' : 'Cancel message'}
            </Button>
          ) : null}
        </div>
      ) : !canSend && (EDITABLE_STATUSES.includes(c.status) || c.status === 'SENDING' || c.failedCount > 0) ? (
        <p className="mt-3 text-xs text-muted-foreground">You can view this message. Changing or cancelling it needs the Send notifications permission.</p>
      ) : null}

      <RecipientList key={c.id} campaignId={c.id} channels={c.channels} skippedByReason={c.skippedByReason} cancelledCount={c.cancelledCount} />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={c.status === 'SENDING' ? 'Cancel the remaining messages?' : 'Cancel this message?'}
        description={c.status === 'SENDING' ? 'Messages not yet handed to a channel will not be sent. Ones already handed over still finish.' : 'It will not be sent. You cannot undo this.'}
        confirmLabel="Yes, cancel"
        cancelLabel="Keep it"
        destructive
        loading={cancel.isPending}
        onConfirm={doCancel}
      />
    </div>
  );
}
