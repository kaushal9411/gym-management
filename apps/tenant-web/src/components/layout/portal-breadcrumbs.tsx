'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { buildBreadcrumbTrail } from '@/features/navigation/breadcrumb-trail';
import { useTenant } from '@/features/tenant/tenant-provider';

/**
 * Auto-derived from the URL path — plugs in for any route without per-page wiring. Feature-flag aware:
 * a route blocked by a flag collapses to Dashboard > Unavailable (see `buildBreadcrumbTrail`).
 */
export function PortalBreadcrumbs() {
  const pathname = usePathname();
  const tenant = useTenant();
  const trail = buildBreadcrumbTrail(pathname ?? '', tenant.featureFlags, tenant.id === 'platform');

  if (trail.length === 0) return null;

  return (
    <Breadcrumb className="hidden sm:block">
      <BreadcrumbList>
        {trail.map((crumb, index) => (
          <React.Fragment key={`${index}-${crumb.label}`}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {crumb.href ? <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink> : <BreadcrumbPage>{crumb.label}</BreadcrumbPage>}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
