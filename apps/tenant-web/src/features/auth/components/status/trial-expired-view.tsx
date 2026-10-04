'use client';

import Link from 'next/link';
import { Hourglass, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ContactSalesDialog } from '@/features/support/components/contact-sales-dialog';
import { useAppSelector } from '@/store/hooks';
import { StatusScreen } from '../status-screen';
import { StatusShell } from './status-shell';

/**
 * Expired trials keep access to the billing rescue path (auth + billing
 * endpoints stay open server-side — see tenant.middleware.ts), so "Choose
 * a plan" leads to the real checkout. Signed-out visitors go through login
 * first; login still works after expiry by design.
 */
export function TrialExpiredView() {
  const isAuthenticated = useAppSelector((state) => state.auth.user !== null);

  return (
    <StatusShell>
      <StatusScreen
        bare
        icon={Hourglass}
        badge={Sparkles}
        tone="warning"
        eyebrow="Trial ended"
        title="Your free trial has ended"
        description="We hope FitCloud made running your gym easier! Pick a plan to keep your members, schedules and data exactly where you left them — nothing has been deleted."
        footnote="Your data is retained for 14 days after trial expiry."
      >
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href={isAuthenticated ? '/billing' : '/login'}>
            {isAuthenticated ? 'Choose a plan' : 'Sign in to choose a plan'}
          </Link>
        </Button>
        <ContactSalesDialog topic="sales" triggerLabel="Talk to sales" />
      </StatusScreen>
    </StatusShell>
  );
}
