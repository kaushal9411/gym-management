import type { Metadata } from 'next';
import { Wrench } from 'lucide-react';

import { RefreshButton } from '@/features/auth/components/refresh-button';
import { StatusScreen } from '@/features/auth/components/status-screen';

export const metadata: Metadata = { title: 'Maintenance' };

export default function MaintenancePage() {
  return (
    <StatusScreen
      icon={Wrench}
      tone="neutral"
      title="Scheduled maintenance in progress"
      description="We're making FitCloud better and will be back shortly. Your data is safe, and member check-in continues to work offline."
      footnote={
        <>
          Live updates at{' '}
          <a href="https://status.fitcloud.com" className="font-medium text-primary underline-offset-4 hover:underline">
            status.fitcloud.com
          </a>
        </>
      }
    >
      <RefreshButton />
    </StatusScreen>
  );
}
