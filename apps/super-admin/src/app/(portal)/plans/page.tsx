import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { PlansListPage } from '@/features/plans/components/plans-list-page';

export default function PlansPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <PlansListPage />
    </Suspense>
  );
}
