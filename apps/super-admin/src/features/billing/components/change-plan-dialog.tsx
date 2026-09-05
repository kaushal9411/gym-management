'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Plan } from '@/features/plans/types';
import { toBillingError, useChangePlan } from '../hooks/use-billing';
import type { PaymentLinkResult } from '../types';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

function formatMoney(amount: string | number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
}

/**
 * Upgrade/downgrade/assign a plan — "Assign manually" marks it paid
 * immediately with no online payment collected (e.g. paid offline/bank
 * transfer), "Send payment link" generates a real Razorpay Payment Link
 * that switches the plan automatically once paid (see
 * `AdminTenantBillingService#changePlan`). Shared by the Plan Detail
 * page's subscriber list (pick a tenant for a fixed plan) and the Tenant
 * Detail page (pick a plan for a fixed tenant) — same action, same dialog,
 * just reached from opposite directions.
 */
export function ChangePlanDialog({
  tenant,
  currentPlanId,
  plans,
  onClose,
}: {
  tenant: { id: string; name: string } | null;
  currentPlanId: string;
  plans: Plan[];
  onClose: () => void;
}) {
  const changePlan = useChangePlan(tenant?.id ?? '');
  const [targetPlanId, setTargetPlanId] = React.useState('');
  const [linkResult, setLinkResult] = React.useState<PaymentLinkResult | null>(null);

  React.useEffect(() => {
    setTargetPlanId('');
    setLinkResult(null);
  }, [tenant]);

  if (!tenant) return null;
  const otherPlans = plans.filter((p) => p.isActive && p.id !== currentPlanId);

  const run = (mode: 'manual' | 'payment_link') => {
    if (!targetPlanId) {
      toast.error('Pick a plan first.');
      return;
    }
    changePlan.mutate(
      { planId: targetPlanId, mode },
      {
        onSuccess: (result) => {
          if (mode === 'manual') {
            toast.success(`${tenant.name} moved to the new plan.`);
            onClose();
          } else {
            setLinkResult(result as PaymentLinkResult);
            toast.success('Payment link created — send it to the tenant.');
          }
        },
        onError: (err) => toast.error(toBillingError(err).message),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change plan — {tenant.name}</DialogTitle>
        </DialogHeader>

        {linkResult ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Send this link to the tenant to complete the switch once paid.</p>
            <div className="flex items-center gap-2">
              <Input readOnly value={linkResult.shortUrl} className="h-9 text-xs" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(linkResult.shortUrl);
                  toast.success('Copied.');
                }}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
            <Button variant="outline" className="w-full" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>New plan</Label>
              <select className={selectClassName} value={targetPlanId} onChange={(e) => setTargetPlanId(e.target.value)}>
                <option value="">Select a plan…</option>
                {otherPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatMoney(p.priceMonthly, p.currency)}/mo
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" disabled={changePlan.isPending} onClick={() => run('manual')}>
                Assign manually
              </Button>
              <Button disabled={changePlan.isPending} onClick={() => run('payment_link')}>
                Send payment link
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Manually</strong> switches the plan immediately (e.g. paid offline). <strong>Send payment link</strong> generates a real Razorpay link — the
              plan switches automatically once paid.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
