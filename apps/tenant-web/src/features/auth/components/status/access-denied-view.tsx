'use client';

import Link from 'next/link';
import { Lock, ShieldX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '../../constants';
import { StatusScreen } from '../status-screen';
import { StatusShell } from './status-shell';

export function AccessDeniedView() {
  return (
    <StatusShell>
      <StatusScreen
        bare
        icon={ShieldX}
        badge={Lock}
        tone="destructive"
        eyebrow="Error 403"
        title="You don't have access to this page"
        description="Your role doesn't include permission for this area. If you believe this is a mistake, ask your gym owner or manager to update your access."
        footnote="Error code: 403 · FORBIDDEN"
      >
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href={AUTH_ROUTES.login}>Back to login</Link>
        </Button>
      </StatusScreen>
    </StatusShell>
  );
}
