'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PowerOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/features/reports/components/ui';
import { useTenant } from '@/features/tenant/tenant-provider';
import { getRouteFeature } from './route-features';

/**
 * Route-level feature-flag guard mounted once in `app/(portal)/layout.tsx`. When the current
 * route belongs to a module that is not in `tenant.featureFlags` (plan or platform kill switch),
 * the page is never mounted — so it can't fire its (now 403-ing) queries or flash error states —
 * and a clear "not available" state with a way back is rendered instead. No redirect: a redirect
 * would loop with the sidebar's remembered route and hides why the page is gone.
 * Skipped on the platform host (no real tenant => empty flags, `RequireAuth` handles that case).
 */
export function RequireFeatureRoute({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tenant = useTenant();
  const feature = getRouteFeature(pathname ?? '');

  if (!feature || tenant.id === 'platform' || tenant.featureFlags.includes(feature)) return <>{children}</>;

  return (
    <EmptyState
      icon={PowerOff}
      title="This feature isn't available"
      description="This module is currently unavailable for your gym. If you think this is a mistake, please contact your administrator."
      action={
        <Button asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      }
      className="py-20"
    />
  );
}
