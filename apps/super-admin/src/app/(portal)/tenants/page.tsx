import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { TenantsListPage } from '@/features/tenants/components/list/tenants-list-page';

export default function TenantsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <TenantsListPage />
    </Suspense>
  );
}
