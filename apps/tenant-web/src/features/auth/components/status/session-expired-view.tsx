'use client';

import Link from 'next/link';
import { TimerOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '../../constants';
import { StatusScreen } from '../status-screen';

export function SessionExpiredView() {
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
