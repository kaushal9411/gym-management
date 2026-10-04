'use client';

import Link from 'next/link';
import { CreditCard, Eye } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ContactSalesDialog } from '@/features/support/components/contact-sales-dialog';
import { useAppSelector } from '@/store/hooks';
import { StatusScreen } from '../status-screen';
import { StatusShell } from './status-shell';

/** Same billing rescue path as the trial-expired screen — renewal happens at /billing. */
export function SubscriptionExpiredView() {
  const isAuthenticated = useAppSelector((state) => state.auth.user !== null);

  return (
    <StatusShell>
      <StatusScreen
        bare
        icon={CreditCard}
        badge={Eye}
        tone="warning"
        eyebrow="Read-only mode"
        title="Subscription expired"
        description="This gym's FitCloud subscription has lapsed, so the portal is temporarily read-only. Gym owners can renew to restore full access immediately."
        footnote="Staff and members: no action needed from you — your data is safe."
      >
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href={isAuthenticated ? '/billing' : '/login'}>
            {isAuthenticated ? 'Renew subscription' : 'Sign in to renew (owners)'}
          </Link>
        </Button>
        <ContactSalesDialog topic="billing" triggerLabel="Contact billing" />
      </StatusScreen>
    </StatusShell>
  );
}
