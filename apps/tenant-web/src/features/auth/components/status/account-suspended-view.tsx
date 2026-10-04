'use client';

import { Ban, PauseCircle, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StatusScreen } from '../status-screen';
import { StatusShell } from './status-shell';

export function AccountSuspendedView() {
  return (
    <StatusShell>
      <StatusScreen
        bare
        icon={Ban}
        badge={PauseCircle}
        tone="destructive"
        eyebrow="Account suspended"
        title="This account is suspended"
        description="Your account has been suspended by your gym's administrator. Contact your gym owner to restore access."
        footnote={
          <>
            Gym owner unavailable? Reach FitCloud support at{' '}
            <a href="mailto:support@fitcloud.com" className="font-medium text-primary underline underline-offset-4 hover:no-underline">
              support@fitcloud.com
            </a>
          </>
        }
      >
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          <a href="mailto:support@fitcloud.com">
            <Mail aria-hidden /> Contact support
          </a>
        </Button>
      </StatusScreen>
    </StatusShell>
  );
}
