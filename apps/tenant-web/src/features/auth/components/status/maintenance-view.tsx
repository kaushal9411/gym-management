'use client';

import { Wrench } from 'lucide-react';

import { RefreshButton } from '../refresh-button';
import { StatusScreen } from '../status-screen';

export function MaintenanceView() {
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
