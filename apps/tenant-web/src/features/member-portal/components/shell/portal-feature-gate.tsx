'use client';

import * as React from 'react';
import Link from 'next/link';
import { PowerOff } from 'lucide-react';

import { MEMBER_PORTAL_ROUTES } from '../../constants';
import { usePortalRouteEnabled } from '../../hooks/use-portal-nav';
import { EmptyBlock } from '../kit/empty-block';
import { heroActionClass } from '../kit/portal-hero';

/**
 * Route-level kill switch for the member portal: when the module that owns `pathname` is off for this gym, the page is NOT rendered
 * (so it fires no request the API would 403) and a friendly "unavailable" state shows instead.
 */
export function PortalFeatureGate({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const enabled = usePortalRouteEnabled(pathname);
  if (enabled) return <>{children}</>;
  return (
    <div className="rounded-3xl border bg-card">
      <EmptyBlock
        icon={PowerOff}
        title="This section isn't available right now"
        description="Your gym has switched this feature off. Check back later or ask the front desk."
        action={
          <Link href={MEMBER_PORTAL_ROUTES.dashboard} className={heroActionClass('solid')}>
            Back to dashboard
          </Link>
        }
      />
    </div>
  );
}
