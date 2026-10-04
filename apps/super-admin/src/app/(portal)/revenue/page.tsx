import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { RevenuePage } from '@/features/revenue/components/revenue-page';

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <RevenuePage />
    </Suspense>
  );
}
