'use client';

import Link from 'next/link';
import { ShieldX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '../../constants';
import { StatusScreen } from '../status-screen';

export function AccessDeniedView() {
  return (
    <StatusScreen
      icon={ShieldX}
      tone="destructive"
      title="You don't have access to this page"
      description="Your role doesn't include permission for this area. If you believe this is a mistake, ask your gym owner or manager to update your access."
      footnote="Error code: 403 · FORBIDDEN"
    >
      <Button asChild className="w-full sm:w-auto">
        <Link href={AUTH_ROUTES.login}>Back to login</Link>
      </Button>
    </StatusScreen>
  );
}
