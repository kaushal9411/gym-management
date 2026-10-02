'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingButton } from '@/components/ui/loading-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { FormAlert } from '@/features/auth/components/form-alert';
import { loadRazorpayScript } from '@/lib/razorpay-checkout';
import { MEMBER_PORTAL_ROUTES } from '@/features/member-portal/constants';
import { useMemberProfile, useStartRenewalCheckout, useVerifyRenewalCheckout } from '@/features/member-portal/hooks/use-member-portal';
import { toMemberAuthServiceError } from '@/features/member-portal/services/member-api-client';

/**
 * Renews the member's CURRENT plan only (no self-service upgrade/downgrade
 * — a bigger, separate feature) and only once it has actually expired, same
 * rule as staff's own Renew action. Mirrors `features/billing/components/checkout-dialog.tsx`'s
 * Razorpay Orders + Checkout-modal flow exactly, just without a plan picker.
 */
export default function MemberRenewPage() {
  const { data: profile, isLoading } = useMemberProfile();
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [openingModal, setOpeningModal] = React.useState(false);

  const startCheckout = useStartRenewalCheckout();
  const verifyCheckout = useVerifyRenewalCheckout();

  const submit = () => {
    setError(null);
    startCheckout.mutate(undefined, {
      onSuccess: async (result) => {
        if (!result.requiresPayment) {
          toast.success('Your membership has been renewed.');
          router.push(MEMBER_PORTAL_ROUTES.dashboard);
          return;
        }

        setOpeningModal(true);
        const loaded = await loadRazorpayScript();
        setOpeningModal(false);
        if (!loaded || !window.Razorpay) {
          setError('Could not load the payment checkout. Please try again.');
          return;
        }

        const razorpay = new window.Razorpay({
          key: result.keyId,
          amount: result.amount,
          currency: result.currency,
          order_id: result.orderId,
          name: 'FitCloud',
          description: profile?.currentMembership ? `${profile.currentMembership.planName} plan renewal` : 'Membership renewal',
          theme: { color: '#16a34a' },
          handler: (response) => {
            verifyCheckout.mutate(
              {
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
                    toast.success('Your membership has been renewed.');
                    router.push(MEMBER_PORTAL_ROUTES.dashboard);
                  } else {
                    setError('Payment verification failed. If you were charged, contact the front desk — your membership has not been renewed.');
                  }
                },
                onError: (err) => setError(toMemberAuthServiceError(err).message),
              },
            );
          },
          modal: {
            ondismiss: () => setError('Checkout closed before payment completed. Your membership has not been renewed — try again when ready.'),
          },
        });
        razorpay.open();
      },
      onError: (err) => setError(toMemberAuthServiceError(err).message),
    });
  };

  const submitting = startCheckout.isPending || openingModal || verifyCheckout.isPending;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Renew membership</h1>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !profile?.currentMembership ? (
        <EmptyState icon={RefreshCw} title="No membership on file" description="Contact the front desk to get a membership plan set up." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{profile.currentMembership.planName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormAlert variant="error" message={error} />
            <p className="text-sm text-muted-foreground">
              Your membership expired on {new Date(profile.currentMembership.endDate).toLocaleDateString()}. Renewing starts a fresh period from today at
              this plan&apos;s current price.
            </p>
            <p className="text-xs text-muted-foreground">
              You&apos;ll pay in Razorpay&apos;s own secure checkout popup — this app never sees your card or UPI details.
            </p>
            <LoadingButton
              type="button"
              className="w-full"
              onClick={submit}
              loading={submitting}
              loadingText={openingModal ? 'Opening checkout…' : verifyCheckout.isPending ? 'Confirming…' : 'Starting checkout…'}
            >
              Renew &amp; Pay
            </LoadingButton>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
