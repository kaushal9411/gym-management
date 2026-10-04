import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { PaymentsPage } from '@/features/payments/components/payments-page';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <PaymentsPage />
    </Suspense>
  );
}
