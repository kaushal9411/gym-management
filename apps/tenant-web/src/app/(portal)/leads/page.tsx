'use client';

import { Suspense } from 'react';

import { RequirePermission } from '@/features/auth/guards/require-permission';
import { LeadsDashboard } from '@/features/leads/components/dashboard/leads-dashboard';

export default function LeadsPage() {
  return (
    <RequirePermission permission="leads:view">
      <Suspense fallback={null}>
        <LeadsDashboard />
      </Suspense>
    </RequirePermission>
  );
}
