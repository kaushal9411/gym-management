'use client';

import { useParams } from 'next/navigation';

import { InvoiceDetailContent } from '@/features/member-portal/components/account/invoice-detail-content';

export default function MemberInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <InvoiceDetailContent id={id} />;
}
