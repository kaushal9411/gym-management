'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { CheckCircle2, Clock, Send, Wallet } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useVerifyPaymentStatus } from '@/features/finance/hooks/use-finance';
import type { MemberPaymentStatus } from '@/features/finance/types';
import type { MemberDetail } from '@/features/members/types';
import { useCurrencySymbol } from '@/lib/currency';
import { IconChip, ProgressBar, formatMoney, tint } from './detail-ui';
import { PanelCard } from './detail-ui';
import { useMemberMoney } from './use-member-money';

const STATUS_VARIANT: Record<string, 'success' | 'secondary' | 'destructive' | 'outline'> = {
  SUCCESS: 'success',
  PENDING: 'secondary',
  FAILED: 'destructive',
};

function statusLabel(status: MemberPaymentStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ');
}

export function MemberPaymentPanel({ data, canSendLink, onSendLink }: { data: MemberDetail; canSendLink: boolean; onSendLink: () => void }) {
  const symbol = useCurrencySymbol();
  const { items, totalPaid, due, totalBilled, payments } = useMemberMoney(data.id, data.outstandingAmount);
  const queryClient = useQueryClient();
  const verify = useVerifyPaymentStatus();
  const pendingLinks = items.filter((p) => p.status === 'PENDING' && p.method === 'ONLINE_GATEWAY');
  const pendingIds = pendingLinks.map((p) => p.id).join(',');

  // Razorpay's webhook can't reach a local dev machine (and can be delayed anywhere), so ask Razorpay directly while a link is unpaid.
  const checkPending = React.useCallback(
    (announce: boolean) => {
      if (!pendingIds) return;
      for (const id of pendingIds.split(',')) {
        verify.mutate(id, {
          onSuccess: (result) => {
            // The "Payment received" toast itself comes from the realtime `payment:updated` event the API emits.
            if (result.status !== 'PENDING') {
              void queryClient.invalidateQueries({ queryKey: ['members'] });
            } else if (announce) {
              toast.message('Still waiting for the member to pay.');
            }
          },
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `verify.mutate` is stable; depending on the whole mutation object would restart the interval every render.
    [pendingIds, queryClient],
  );
  React.useEffect(() => {
    if (!pendingIds) return;
    checkPending(false);
    const timer = setInterval(() => checkPending(false), 8000);
    return () => clearInterval(timer);
  }, [pendingIds, checkPending]);

  return (
    <PanelCard
      icon={Wallet}
      accent="success"
      title="Payment history"
      delay={0.38}
      right={<span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: tint('success', 14), color: 'var(--success)' }}>{items.length} {items.length === 1 ? 'receipt' : 'receipts'}</span>}
    >
      <div>
        <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>
            Paid <b className="text-foreground">{formatMoney(symbol, totalPaid)}</b>
          </span>
          <span>
            Due <b style={{ color: due > 0 ? 'var(--destructive)' : 'var(--success)' }}>{formatMoney(symbol, due)}</b>
          </span>
        </div>
        <ProgressBar className="mt-1.5" percent={totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 100} accent="success" />
      </div>

      <div className="flex flex-col">
        {due > 0 ? (
          <div className="relative flex gap-3 pb-4">
            <span aria-hidden className="absolute left-3.5 top-8 bottom-0 w-0.5 bg-border" />
            <IconChip icon={Clock} accent="destructive" className="size-7 rounded-full" />
            <div
              className="min-w-0 flex-1 rounded-xl border border-dashed p-3"
              style={{ borderColor: tint('destructive', 50), backgroundColor: tint('destructive', 6) }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">Balance pending</p>
                  <p className="text-xs text-muted-foreground">{data.currentMembership?.planName ?? 'Outstanding'} · due now</p>
                </div>
                <span className="font-extrabold tabular-nums" style={{ color: 'var(--destructive)' }}>
                  {formatMoney(symbol, due)}
                </span>
              </div>
              {pendingLinks.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Payment link sent, waiting for payment…</span>
                  <Button type="button" size="sm" variant="outline" disabled={verify.isPending} onClick={() => checkPending(true)}>
                    {verify.isPending ? 'Checking…' : 'Check status'}
                  </Button>
                </div>
              ) : canSendLink ? (
                <Button type="button" size="sm" className="mt-2.5" onClick={onSendLink}>
                  <Send className="size-3.5" /> Send payment link
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {payments.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          items.slice(0, 6).map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.1 * i }}
              className="relative flex gap-3 pb-4 last:pb-0"
            >
              {i < Math.min(items.length, 6) - 1 ? <span aria-hidden className="absolute left-3.5 top-8 bottom-0 w-0.5 bg-border" /> : null}
              <IconChip icon={CheckCircle2} accent={p.status === 'SUCCESS' ? 'success' : 'warning'} className="size-7 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <b className="text-sm">{p.paymentNumber}</b>
                  <Badge variant={STATUS_VARIANT[p.status] ?? 'outline'}>{statusLabel(p.status)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(p.paymentDate).toLocaleDateString()} · {p.method.replace('_', ' ').toLowerCase()}
                  {p.membership ? ` · ${p.membership.planName}` : ''}
                </p>
              </div>
              <span className="font-extrabold tabular-nums" style={{ color: 'var(--success)' }}>
                {formatMoney(symbol, p.finalAmount)}
              </span>
            </motion.div>
          ))
        )}
      </div>
    </PanelCard>
  );
}
