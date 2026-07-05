'use client';

import { CreditCard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StatusScreen } from '../status-screen';

export function SubscriptionExpiredView() {
  return (
    <StatusScreen
      icon={CreditCard}
      tone="warning"
      title="Subscription expired"
      description="This gym's FitCloud subscription has lapsed, so the portal is temporarily read-only. Gym owners can renew to restore full access immediately — member check-in keeps working during the grace period."
      footnote="Staff and members: no action needed from you — your data is safe."
    >
      {/* Billing portal ships with the subscription phase — placeholder target. */}
      <Button asChild className="w-full sm:w-auto">
        <a href="#renew">Renew subscription (owners)</a>
      </Button>
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <a href="mailto:billing@fitcloud.com">Contact billing</a>
      </Button>
    </StatusScreen>
  );
}
