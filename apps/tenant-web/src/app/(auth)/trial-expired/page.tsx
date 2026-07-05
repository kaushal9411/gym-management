import type { Metadata } from 'next';

import { TrialExpiredView } from '@/features/auth/components/status/trial-expired-view';

export const metadata: Metadata = { title: 'Trial expired' };

export default function TrialExpiredPage() {
  return <TrialExpiredView />;
}
