'use client';

import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { SendMessagePage } from '@/features/communications/components/send/send-page';

export default function SendMessageRoute() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <SendMessagePage />
    </Suspense>
  );
}
