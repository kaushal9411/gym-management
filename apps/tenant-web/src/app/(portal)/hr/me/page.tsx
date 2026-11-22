'use client';

import { Suspense } from 'react';

import { MePage } from '@/features/hr/components/me/me-page';

export default function HrMePage() {
  return (
    <Suspense fallback={null}>
      <MePage />
    </Suspense>
  );
}
