'use client';

import { usePaymentList } from '@/features/finance/hooks/use-finance';
import { useFeatureEnabled } from '@/features/tenant/use-feature-flag';

/**
 * One shared query (same key everywhere) for the hero, stat tiles and payment panel — totals come from SUCCESS payments only.
 * `/payments` belongs to the `payments` module: with it off no request is made (callers also hide their money UI).
 */
export function useMemberMoney(memberId: string, outstandingAmount: string) {
  const paymentsOn = useFeatureEnabled('payments');
  const payments = usePaymentList({ memberId, page: 1, limit: 50, sortBy: 'paymentDate', sortDir: 'desc' }, { enabled: paymentsOn });
  const items = payments.data?.items ?? [];
  const totalPaid = items.filter((p) => p.status === 'SUCCESS').reduce((sum, p) => sum + Number(p.finalAmount), 0);
  const due = Number(outstandingAmount) || 0;
  return { payments, items, totalPaid, due, totalBilled: totalPaid + due };
}
