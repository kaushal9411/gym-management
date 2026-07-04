import type { Metadata } from 'next';
import Link from 'next/link';
import { TimerOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StatusScreen } from '@/features/auth/components/status-screen';
import { AUTH_ROUTES } from '@/features/auth/constants';

export const metadata: Metadata = { title: 'Session expired' };

export default function SessionExpiredPage() {
  return (
    <StatusScreen
      icon={TimerOff}
      tone="neutral"
      title="Your session has expired"
      description="For your security you were signed out after a period of inactivity. Sign in again to pick up where you left off."
    >
      <Button asChild className="w-full sm:w-auto">
        <Link href={AUTH_ROUTES.login}>Sign in again</Link>
      </Button>
    </StatusScreen>
  );
}
