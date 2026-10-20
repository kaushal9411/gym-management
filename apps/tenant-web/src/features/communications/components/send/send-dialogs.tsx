'use client';

import * as React from 'react';
import { ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingButton } from '@/components/ui/loading-button';
import { CHANNEL_META } from '../../constants';
import type { Channel } from '../../types';

const fmt = (n: number) => n.toLocaleString('en-IN');

/** Confirm step above 100 recipients: the user must tick the box before `confirmLargeSend: true` is ever sent. */
export function ConfirmLargeSendDialog({
  open,
  count,
  threshold,
  channels,
  scheduled,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  count: number;
  threshold: number;
  channels: Channel[];
  scheduled: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [ack, setAck] = React.useState(false);
  React.useEffect(() => {
    if (!open) setAck(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => (!o && !loading ? onCancel() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-warning/20 sm:mx-0">
            <ShieldAlert className="size-5 text-warning-foreground" aria-hidden />
          </div>
          <DialogTitle>{scheduled ? 'Schedule' : 'Send'} to {fmt(count)} members?</DialogTitle>
          <DialogDescription>
            This is more than {fmt(threshold)} people, over {channels.map((c) => CHANNEL_META[c].label).join(', ')}. Messages cannot be recalled once they are handed to a channel.
          </DialogDescription>
        </DialogHeader>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border bg-muted/40 p-3 text-sm">
          <Checkbox checked={ack} onCheckedChange={(c) => setAck(c === true)} className="mt-0.5" aria-label="I understand this goes to a large audience" />
          <span>
            I understand this {scheduled ? 'will go' : 'goes'} to <b>{fmt(count)} members</b>.
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={loading} onClick={onCancel}>
            Go back
          </Button>
          <LoadingButton type="button" disabled={!ack} loading={loading} loadingText="Sending…" onClick={onConfirm}>
            {scheduled ? 'Schedule it' : 'Send it'}
          </LoadingButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** In-page replacement for `window.confirm` when leaving a half-written message. */
export function LeaveDialog({
  open,
  canSaveDraft,
  saving,
  onStay,
  onLeave,
  onSaveAndLeave,
}: {
  open: boolean;
  canSaveDraft: boolean;
  saving: boolean;
  onStay: () => void;
  onLeave: () => void;
  onSaveAndLeave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => (!o && !saving ? onStay() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave without sending?</DialogTitle>
          <DialogDescription>Your message has changes that are not sent or saved. If you leave now they will be lost.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={saving} onClick={onLeave}>
            Discard and leave
          </Button>
          {canSaveDraft ? (
            <LoadingButton type="button" variant="outline" loading={saving} loadingText="Saving…" onClick={onSaveAndLeave}>
              Save draft and leave
            </LoadingButton>
          ) : null}
          <Button type="button" disabled={saving} onClick={onStay}>
            Keep editing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
