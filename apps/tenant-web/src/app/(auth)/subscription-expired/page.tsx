import type { Metadata } from 'next';

import { SubscriptionExpiredView } from '@/features/auth/components/status/subscription-expired-view';

export const metadata: Metadata = { title: 'Subscription expired' };

export default function SubscriptionExpiredPage() {
  return <SubscriptionExpiredView />;
}
