import type { Metadata } from 'next';

import { SessionExpiredView } from '@/features/auth/components/status/session-expired-view';

export const metadata: Metadata = { title: 'Session expired' };

export default function SessionExpiredPage() {
  return <SessionExpiredView />;
}
