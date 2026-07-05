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
import { NAV_ITEMS } from '@/features/navigation/nav-config';

function labelFor(segment: string): string {
  const match = NAV_ITEMS.find((item) => item.href === `/${segment}`);
  if (match) return match.label;
  return segment
    .split('-')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

/** Auto-derived from the URL path — plugs in for any route without per-page wiring. */
export function PortalBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <Breadcrumb className="hidden sm:block">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join('/')}`;
          const isLast = index === segments.length - 1;
          return (
            <React.Fragment key={href}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{labelFor(segment)}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={href}>{labelFor(segment)}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
