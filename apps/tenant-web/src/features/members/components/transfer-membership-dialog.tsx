'use client';

import * as React from 'react';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { Skeleton } from '@/components/ui/skeleton';
import { MemberCheckinSearch } from '@/features/attendance/components/member-checkin-search';
import { useCurrencySymbol } from '@/lib/currency';
import { toMemberError, useMembershipTransferPreview, useTransferMembership } from '../hooks/use-members';
import type { MemberListItem } from '../types';

interface TransferMembershipDialogProps {
  memberId: string;
  memberName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Hand this member's current membership to another member. The sender's plan
 * is cancelled and the receiver gets the full plan period starting today —
 * the transfer fee (the gym's default, editable or waivable here) is recorded
 * on the transfer, not charged as a payment.
 */
export function TransferMembershipDialog({ memberId, memberName, open, onOpenChange }: TransferMembershipDialogProps) {
  const currencySymbol = useCurrencySymbol();
  const preview = useMembershipTransferPreview(memberId, open);
  const transfer = useTransferMembership();

  const [receiver, setReceiver] = React.useState<MemberListItem | null>(null);
  const [fee, setFee] = React.useState('');
  const [reason, setReason] = React.useState('');

  // Fresh form every time the dialog opens; the fee starts at the gym's default once it has loaded.
  React.useEffect(() => {
    if (open) {
      setReceiver(null);
      setReason('');
      setFee('');
    }
  }, [open]);
  React.useEffect(() => {
    if (open && preview.data) setFee(preview.data.defaultFee);
  }, [open, preview.data]);

  const membership = preview.data?.membership ?? null;
  const blockedReason = preview.data?.blockedReason ?? null;
  const receiverBlocked =
    receiver && receiver.id === memberId
      ? 'Choose a different member.'
      : receiver?.currentMembership && (receiver.currentMembership.status === 'ACTIVE' || receiver.currentMembership.status === 'PENDING')
        ? `${receiver.name} already has an ${receiver.currentMembership.status === 'ACTIVE' ? 'active' : 'upcoming'} membership — they can't receive another.`
        : null;
  const feeNumber = Number(fee);
  const maxFee = membership ? Number(membership.priceAtAssignment) : 0;
  const feeTooHigh = fee !== '' && feeNumber > maxFee;
  const feeValid = fee !== '' && Number.isFinite(feeNumber) && feeNumber >= 0 && !feeTooHigh;
  const canSubmit = !!membership && !blockedReason && !!receiver && !receiverBlocked && feeValid && !transfer.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !receiver) return;
    transfer.mutate(
      { id: memberId, payload: { toMemberId: receiver.id, fee: feeNumber, reason: reason.trim() || undefined } },
      {
        onSuccess: () => {
          toast.success(`Membership transferred to ${receiver.name}.`);
          onOpenChange(false);
        },
        onError: (err) => toast.error(toMemberError(err).message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transfer membership</DialogTitle>
          <DialogDescription>
            Move {memberName}&apos;s current membership to another member. Their plan is cancelled and the other member gets the full plan from today.
          </DialogDescription>
        </DialogHeader>

        {preview.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : preview.isError ? (
          <p className="text-sm text-destructive">Couldn&apos;t load this membership. Close the dialog and try again.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {membership ? (
              <div className="rounded-xl border bg-muted/40 p-3.5 text-sm">
                <p className="font-semibold">{membership.planName}</p>
                <p className="mt-0.5 text-muted-foreground">
                  {new Date(membership.startDate).toLocaleDateString()} – {new Date(membership.endDate).toLocaleDateString()} · {currencySymbol}
                  {membership.priceAtAssignment}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Used {membership.daysUsed} {membership.daysUsed === 1 ? 'day' : 'days'} · {membership.daysRemaining} left
                </p>
              </div>
            ) : null}

            {blockedReason ? (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{blockedReason}</span>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Transfer to</Label>
              {receiver ? (
                <div className="flex h-10 items-center justify-between rounded-xl border border-input bg-muted/40 px-3.5 text-sm">
                  <span className="flex items-center gap-2 font-semibold">
                    {memberName} <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden /> {receiver.name} ({receiver.memberId})
                  </span>
                  <button type="button" onClick={() => setReceiver(null)} className="text-muted-foreground hover:text-foreground" aria-label="Choose a different member">
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <MemberCheckinSearch className="max-w-none" inline placeholder="Search the member who will receive it…" onSelect={setReceiver} />
              )}
              {receiverBlocked ? <p className="text-xs text-destructive">{receiverBlocked}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transferFee">Transfer fee ({currencySymbol})</Label>
                <Input
                  id="transferFee"
                  type="number"
                  min={0}
                  max={maxFee}
                  step="0.01"
                  inputMode="decimal"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  aria-invalid={fee !== '' && !feeValid}
                />
                {feeTooHigh ? (
                  <p className="text-xs text-destructive" role="alert">
                    Fee can&apos;t be more than the membership amount ({currencySymbol}
                    {membership?.priceAtAssignment}).
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Gym default, change or set 0 to waive. Can&apos;t exceed the membership amount. Recorded on the transfer only.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="transferReason">Reason (optional)</Label>
                <Input id="transferReason" maxLength={500} placeholder="e.g. moving city" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <LoadingButton type="submit" loading={transfer.isPending} loadingText="Transferring…" disabled={!canSubmit}>
                Transfer membership
              </LoadingButton>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
