import { NAV_ITEMS } from './nav-config';
import { getRouteFeature } from './route-features';

export interface BreadcrumbCrumb {
  label: string;
  /** Present only for crumbs that are safe to link to (never a flag-blocked route, never the current page). */
  href?: string;
}

function labelFor(segment: string): string {
  const match = NAV_ITEMS.find((item) => item.href === `/${segment}`);
  if (match) return match.label;
  return segment
    .split('-')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

/** True when `pathname` needs a feature flag that the tenant does not have (the platform host has no flags and is never blocked). */
export function isRouteBlocked(pathname: string, featureFlags: string[], isPlatformHost = false): boolean {
  if (isPlatformHost) return false;
  const feature = getRouteFeature(pathname);
  return !!feature && !featureFlags.includes(feature);
}

/**
 * Breadcrumb trail derived from the URL path. On a route blocked by a feature flag (the page shows
 * "This feature isn't available") the trail is only Dashboard > "Unavailable" so it never advertises
 * or links into the blocked section; otherwise a parent crumb that would itself be blocked renders as
 * plain text. Unblocked routes are unchanged. `[]` = render no breadcrumb.
 */
export function buildBreadcrumbTrail(pathname: string, featureFlags: string[], isPlatformHost = false): BreadcrumbCrumb[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [];

  const dashboard: BreadcrumbCrumb = { label: 'Dashboard', href: '/dashboard' };
  if (isRouteBlocked(pathname, featureFlags, isPlatformHost)) return [dashboard, { label: 'Unavailable' }];

  return [
    dashboard,
    ...segments.map((segment, index): BreadcrumbCrumb => {
      const href = `/${segments.slice(0, index + 1).join('/')}`;
      const isLast = index === segments.length - 1;
      return isLast || isRouteBlocked(href, featureFlags, isPlatformHost) ? { label: labelFor(segment) } : { label: labelFor(segment), href };
    }),
  ];
}
