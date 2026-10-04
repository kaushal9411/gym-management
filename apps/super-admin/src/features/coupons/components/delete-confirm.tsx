'use client';

import { toast } from 'sonner';

import { toCouponError, useDeleteCoupon } from '../hooks/use-coupons';
import type { Coupon } from '../types';
import { InlineConfirm } from '@/features/tenants/components/detail/controls/confirm';

/** Inline typed-code delete confirmation (hard delete — explains the consequences). */
export function DeleteCouponConfirm({ coupon, redemptions, onCancel, onDeleted }: { coupon: Coupon; redemptions: number; onCancel: () => void; onDeleted: () => void }) {
  const del = useDeleteCoupon();
  return (
    <InlineConfirm
      slug={coupon.code}
      onCancel={onCancel}
      cfg={{
        title: `Delete ${coupon.code} permanently?`,
        destructive: true,
        slug: true,
        label: 'Delete coupon',
        pending: del.isPending,
        text: (
          <>
            This is a hard delete. {redemptions > 0 ? <><b>{redemptions} logged redemption{redemptions === 1 ? '' : 's'}</b> will be lost and </> : null}
            invoices and subscriptions that used this code will lose the link to it. Anyone who still has the code can no longer use it.
            <b> Disable</b> the coupon instead if you only want to stop new uses.
          </>
        ),
        run: () => del.mutate(coupon.id, {
          onSuccess: () => { toast.success(`Coupon ${coupon.code} deleted`); onDeleted(); },
          onError: (e) => toast.error(toCouponError(e).message),
        }),
      }}
    />
  );
}
