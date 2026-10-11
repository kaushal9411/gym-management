'use client';

import { use } from 'react';

import { RequirePermission } from '@/features/auth/guards/require-permission';
import { LeadDetailView } from '@/features/leads/components/detail/lead-detail-view';

export default function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = use(params);
  return (
    <RequirePermission permission="leads:view">
      <LeadDetailView leadId={leadId} />
    </RequirePermission>
  );
}
