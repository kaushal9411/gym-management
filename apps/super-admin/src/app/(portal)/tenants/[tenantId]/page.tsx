'use client';

import { useParams } from 'next/navigation';

import { TenantDetailView } from '@/features/tenants/components/detail/shell/tenant-detail-view';

/**
 * Tenant control center. Every capability of the previous single-page layout lives on: status actions, reset password,
 * impersonate, delete, plan summary + change plan (Overview control panel / banner), gym profile + branches (Overview),
 * usage, users, audit log, payments/invoices + payment links (Subscription / Billing / Users / Activity tabs).
 */
export default function TenantDetailPage() {
  const params = useParams<{ tenantId: string }>();
  return <TenantDetailView tenantId={params.tenantId} />;
}
