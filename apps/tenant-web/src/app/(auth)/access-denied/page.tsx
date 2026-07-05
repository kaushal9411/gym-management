import type { Metadata } from 'next';

import { AccessDeniedView } from '@/features/auth/components/status/access-denied-view';

export const metadata: Metadata = { title: 'Access denied' };

export default function AccessDeniedPage() {
  return <AccessDeniedView />;
}
