'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { LoadingButton } from '@/components/ui/loading-button';
import { loadRazorpayScript } from '@/lib/razorpay-checkout';
import { useStartInvoicePaymentCheckout, useVerifyInvoicePaymentCheckout } from '../hooks/use-member-portal';
import { toMemberAuthServiceError } from '../services/member-api-client';

interface PayInvoiceButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  size?: 'default' | 'sm' | 'icon';
}

/**
 * Shared by the dashboard's "Outstanding payments" detail modal and the
 * Invoices list — same Razorpay Orders + Checkout-modal round trip as
 * `app/portal/(authenticated)/renew/page.tsx`'s membership renewal, just
 * against an existing invoice's own `totalAmount` instead of a computed
 * plan price. A successful payment can also activate a still-PENDING
 * membership on the backend (see `activatePendingMembershipIfAny`), which
 * is why the verify hook invalidates the whole `member-portal` query key,
 * not just invoices.
 */
export function PayInvoiceButton({ invoiceId, invoiceNumber, size = 'sm' }: PayInvoiceButtonProps) {
  const [opening, setOpening] = React.useState(false);
  const startCheckout = useStartInvoicePaymentCheckout();
  const verifyCheckout = useVerifyInvoicePaymentCheckout();

  const pay = () => {
    startCheckout.mutate(invoiceId, {
      onSuccess: async (result) => {
        if (!result.requiresPayment) return; // never actually happens for an outstanding invoice, but keeps the shared result type honest.

        setOpening(true);
        const loaded = await loadRazorpayScript();
        setOpening(false);
        if (!loaded || !window.Razorpay) {
          toast.error('Could not load the payment checkout. Please try again.');
          return;
        }

        const razorpay = new window.Razorpay({
          key: result.keyId,
          amount: result.amount,
          currency: result.currency,
          order_id: result.orderId,
          name: 'FitCloud',
          description: `Invoice ${invoiceNumber}`,
          theme: { color: '#16a34a' },
          handler: (response) => {
            verifyCheckout.mutate(
              {
                invoiceId,
                paymentId: result.paymentId,
                payload: {
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                },
              },
              {
                onSuccess: (verifyResult) => {
                  if (verifyResult.status === 'SUCCESS') {
                    toast.success(`Invoice ${invoiceNumber} paid.`);
                  } else {
                    toast.error('Payment verification failed. If you were charged, contact the front desk.');
                  }
                },
                onError: (err) => toast.error(toMemberAuthServiceError(err).message),
              },
            );
          },
          modal: {
            ondismiss: () => toast.error('Checkout closed before payment completed.'),
          },
        });
        razorpay.open();
      },
      onError: (err) => toast.error(toMemberAuthServiceError(err).message),
    });
  };

  const submitting = startCheckout.isPending || opening || verifyCheckout.isPending;

  return (
    <LoadingButton type="button" size={size} onClick={pay} loading={submitting} loadingText={opening ? 'Opening…' : 'Pay'}>
      Pay now
    </LoadingButton>
  );
}
