'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BellOff } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { EmptyState } from '@/features/reports/components/ui';
import { COMMUNICATIONS_PERMISSIONS, COMMUNICATIONS_ROUTES } from '../constants';
import { CommunicationsHero } from './communications-hero';

/** Layout of every /communications/* route: shared hero (title, live limits, tabs) then the tab content. Needs `notifications:view`. */
export function CommunicationsShell({ children }: { children: React.ReactNode }) {
  const { hasPermission } = usePermissions();
  if (!hasPermission(COMMUNICATIONS_PERMISSIONS.view)) {
    return (
      <EmptyState
        icon={BellOff}
        title="No access to Communications"
        description="You don't have permission to view notifications. Ask your gym owner for the View notifications permission."
        className="mt-10"
      />
    );
  }
  return (
    <div className="space-y-5">
      <CommunicationsHero />
      {children}
    </div>
  );
}

/** /communications -> Send message (or History when the user cannot send). */
export function CommunicationsIndexRedirect() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const target = hasPermission(COMMUNICATIONS_PERMISSIONS.send) ? COMMUNICATIONS_ROUTES.send : COMMUNICATIONS_ROUTES.history;
  React.useEffect(() => {
    router.replace(target);
  }, [router, target]);
  return <Skeleton className="h-64 w-full rounded-2xl" />;
}
