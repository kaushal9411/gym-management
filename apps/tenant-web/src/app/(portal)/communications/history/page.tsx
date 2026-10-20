'use client';

import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { HistoryPage } from '@/features/communications/components/history/history-page';

export default function CommunicationsHistoryRoute() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <HistoryPage />
    </Suspense>
  );
}
