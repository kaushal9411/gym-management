'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Copy, Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fileToDataUrl } from '@/lib/image-to-data-url';
import { cn } from '@/lib/utils';
import type { Plan } from '@/features/plans/types';
import { toBillingError, useChangePlan } from '../hooks/use-billing';
import type { PaymentLinkResult, PaymentMode } from '../types';

const fieldClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

const PAYMENT_MODE_OPTIONS: Array<{ value: PaymentMode; label: string }> = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CARD', label: 'Card' },
  { value: 'OTHER', label: 'Other' },
];

const MAX_PROOF_BYTES = 4 * 1024 * 1024;

function formatMoney(amount: string | number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ManualFormState {
  paymentMode: PaymentMode | '';
  paymentDate: string;
  amount: string;
  notes: string;
  proofFileName: string;
  proofDataUrl: string;
}

const DEFAULT_MANUAL_FORM: ManualFormState = {
  paymentMode: '',
  paymentDate: todayIso(),
  amount: '',
  notes: '',
  proofFileName: '',
  proofDataUrl: '',
};

/**
 * Upgrade/downgrade/assign a plan — two paths:
 *
 * - **Mark Paid Manually**: opens an inline form (mode of payment, amount,
 *   payment date, optional proof screenshot, optional notes) — same detail
 *   a real payment already carries — then marks it paid immediately (e.g.
 *   paid offline/bank transfer). The plan switches, a real `Payment` row is
 *   recorded (`provider: MANUAL`), and the tenant gets the identical
 *   subscription-activated + invoice emails a real payment triggers.
 * - **Send payment link**: generates a real Razorpay Payment Link — the
 *   plan switches automatically once paid (webhook-driven, unchanged).
 *
 * Shared by the Plan Detail page's subscriber list (pick a tenant for a
 * fixed plan) and the Tenant Detail page (pick a plan for a fixed tenant) —
 * same action, same dialog, just reached from opposite directions.
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
  const [step, setStep] = React.useState<'pick' | 'manual-form'>('pick');
  const [manualForm, setManualForm] = React.useState<ManualFormState>(DEFAULT_MANUAL_FORM);
  const [uploadingProof, setUploadingProof] = React.useState(false);
  const [linkResult, setLinkResult] = React.useState<PaymentLinkResult | null>(null);

  React.useEffect(() => {
    setTargetPlanId('');
    setStep('pick');
    setManualForm(DEFAULT_MANUAL_FORM);
    setLinkResult(null);
  }, [tenant]);

  if (!tenant) return null;
  const otherPlans = plans.filter((p) => p.isActive && p.id !== currentPlanId);
  const targetPlan = otherPlans.find((p) => p.id === targetPlanId) ?? null;

  const openManualForm = () => {
    if (!targetPlanId) {
      toast.error('Pick a plan first.');
      return;
    }
    setManualForm({ ...DEFAULT_MANUAL_FORM, amount: targetPlan ? String(targetPlan.priceMonthly) : '' });
    setStep('manual-form');
  };

  const handleProofFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_PROOF_BYTES) {
      toast.error('File is too large — max 4MB.');
      return;
    }
    setUploadingProof(true);
    try {
      const dataUrl = await fileToDataUrl(file, 1280);
      setManualForm((f) => ({ ...f, proofFileName: file.name, proofDataUrl: dataUrl }));
    } catch {
      toast.error("Couldn't read that file.");
    } finally {
      setUploadingProof(false);
    }
  };

  const submitManual = () => {
    if (!manualForm.paymentMode) {
      toast.error('Pick a mode of payment.');
      return;
    }
    if (!manualForm.paymentDate) {
      toast.error('Pick a payment date.');
      return;
    }
    changePlan.mutate(
      {
        planId: targetPlanId,
        mode: 'manual',
        manual: {
          paymentMode: manualForm.paymentMode,
          paymentDate: manualForm.paymentDate,
          amount: manualForm.amount ? Number(manualForm.amount) : undefined,
          proofDataUrl: manualForm.proofDataUrl || undefined,
          notes: manualForm.notes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(`${tenant.name} marked paid and moved to the new plan.`);
          onClose();
        },
        onError: (err) => toast.error(toBillingError(err).message),
      },
    );
  };

  const sendLink = () => {
    if (!targetPlanId) {
      toast.error('Pick a plan first.');
      return;
    }
    changePlan.mutate(
      { planId: targetPlanId, mode: 'payment_link' },
      {
        onSuccess: (result) => {
          setLinkResult(result as PaymentLinkResult);
          toast.success('Payment link created — send it to the tenant.');
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
        ) : step === 'manual-form' ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Mode of payment</Label>
              <select
                className={fieldClassName}
                value={manualForm.paymentMode}
                onChange={(e) => setManualForm((f) => ({ ...f, paymentMode: e.target.value as PaymentMode }))}
              >
                <option value="">Select…</option>
                {PAYMENT_MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualForm.amount}
                  onChange={(e) => setManualForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder={targetPlan ? formatMoney(targetPlan.priceMonthly, targetPlan.currency) : ''}
                />
              </div>
              <div className="space-y-1">
                <Label>Payment date</Label>
                <Input
                  type="date"
                  max={todayIso()}
                  value={manualForm.paymentDate}
                  onChange={(e) => setManualForm((f) => ({ ...f, paymentDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Proof of payment (optional)</Label>
              {manualForm.proofDataUrl ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="truncate">{manualForm.proofFileName}</span>
                  <button
                    type="button"
                    onClick={() => setManualForm((f) => ({ ...f, proofFileName: '', proofDataUrl: '' }))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground hover:bg-muted/50">
                  <Upload className="size-3.5" />
                  {uploadingProof ? 'Reading…' : 'Upload screenshot'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingProof}
                    onChange={(e) => void handleProofFile(e.target.files?.[0])}
                  />
                </label>
              )}
            </div>

            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <textarea
                className={cn(fieldClassName, 'h-20 resize-none py-2')}
                value={manualForm.notes}
                onChange={(e) => setManualForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Reference number, reason for the manual entry, etc."
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setStep('pick')} disabled={changePlan.isPending}>
                Back
              </Button>
              <Button className="flex-1" onClick={submitManual} disabled={changePlan.isPending || uploadingProof}>
                Mark as paid
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>New plan</Label>
              <select className={fieldClassName} value={targetPlanId} onChange={(e) => setTargetPlanId(e.target.value)}>
                <option value="">Select a plan…</option>
                {otherPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatMoney(p.priceMonthly, p.currency)}/mo
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" disabled={changePlan.isPending} onClick={openManualForm}>
                Mark paid manually
              </Button>
              <Button disabled={changePlan.isPending} onClick={sendLink}>
                Send payment link
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Mark paid manually</strong> captures how it was paid (mode, date, optional proof) and switches the plan immediately.{' '}
              <strong>Send payment link</strong> generates a real Razorpay link — the plan switches automatically once paid.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
