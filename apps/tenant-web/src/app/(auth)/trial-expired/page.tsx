import type { Metadata } from 'next';
import { Hourglass } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StatusScreen } from '@/features/auth/components/status-screen';

export const metadata: Metadata = { title: 'Trial expired' };

export default function TrialExpiredPage() {
  return (
    <StatusScreen
      icon={Hourglass}
      tone="warning"
      title="Your free trial has ended"
      description="We hope FitCloud made running your gym easier! Pick a plan to keep your members, schedules and data exactly where you left them — nothing has been deleted."
      footnote="Your data is retained for 14 days after trial expiry."
    >
      {/* Plan picker ships with the subscription phase — placeholder target. */}
      <Button asChild className="w-full sm:w-auto">
        <a href="#plans">Choose a plan</a>
      </Button>
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <a href="mailto:sales@fitcloud.com">Talk to sales</a>
      </Button>
    </StatusScreen>
  );
}
