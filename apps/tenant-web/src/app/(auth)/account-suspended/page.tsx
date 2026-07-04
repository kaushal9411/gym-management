import type { Metadata } from 'next';
import { Ban } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StatusScreen } from '@/features/auth/components/status-screen';

export const metadata: Metadata = { title: 'Account suspended' };

export default function AccountSuspendedPage() {
  return (
    <StatusScreen
      icon={Ban}
      tone="destructive"
      title="This account is suspended"
      description="Your account has been suspended by your gym's administrator. Contact your gym owner to restore access."
      footnote={
        <>
          Gym owner unavailable? Reach FitCloud support at{' '}
          <a href="mailto:support@fitcloud.com" className="font-medium text-primary underline-offset-4 hover:underline">
            support@fitcloud.com
          </a>
        </>
      }
    >
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <a href="mailto:support@fitcloud.com">Contact support</a>
      </Button>
    </StatusScreen>
  );
}
