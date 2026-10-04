import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { CouponsPage } from '@/features/coupons/components/coupons-page';

/**
 * Coupons list. Old-page capabilities (list, create, delete) live on: create = inline panel, delete = inline typed
 * confirm, plus edit / enable-disable / bulk generate / CSV export / insights. Detail: /coupons/[couponId].
 */
export default function CouponsRoute() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <CouponsPage />
    </Suspense>
  );
}
