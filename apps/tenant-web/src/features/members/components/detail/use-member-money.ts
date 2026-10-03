'use client';

import { usePaymentList } from '@/features/finance/hooks/use-finance';

/** One shared query (same key everywhere) for the hero, stat tiles and payment panel — totals come from SUCCESS payments only. */
export function useMemberMoney(memberId: string, outstandingAmount: string) {
  const payments = usePaymentList({ memberId, page: 1, limit: 50, sortBy: 'paymentDate', sortDir: 'desc' });
  const items = payments.data?.items ?? [];
  const totalPaid = items.filter((p) => p.status === 'SUCCESS').reduce((sum, p) => sum + Number(p.finalAmount), 0);
  const due = Number(outstandingAmount) || 0;
  return { payments, items, totalPaid, due, totalBilled: totalPaid + due };
}
