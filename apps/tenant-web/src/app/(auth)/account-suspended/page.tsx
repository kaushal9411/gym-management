import type { Metadata } from 'next';

import { AccountSuspendedView } from '@/features/auth/components/status/account-suspended-view';

export const metadata: Metadata = { title: 'Account suspended' };

export default function AccountSuspendedPage() {
  return <AccountSuspendedView />;
}
