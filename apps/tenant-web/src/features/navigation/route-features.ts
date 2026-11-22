import { NAV_ITEMS } from './nav-config';

/**
 * Routes that need a tenant feature flag but have no sidebar entry of their own
 * (the sidebar table below only knows the pages it links to).
 */
const EXTRA_ROUTE_FEATURES: { href: string; featureFlag: string }[] = [
  { href: '/invoices', featureFlag: 'payments' }, // invoices live in the payments module but have no nav item
  { href: '/gym-settings/ai', featureFlag: 'ai_coach' }, // a Gym Settings tab, not a nav entry
];

/**
 * Single source of truth for route -> feature-flag gating. Derived from `NAV_ITEMS`
 * (every item that declares a `featureFlag`) plus the extras above, so adding a gated nav
 * item automatically guards its route. Only keys the nav marks are gated: members, staff,
 * branches, membership_plans and the 11 platform flags. Routes without a flag (dashboard,
 * leads, HR, measurements, billing, gym settings, support, settings) are never blocked.
 */
const ROUTE_FEATURES: { href: string; featureFlag: string }[] = [
  ...NAV_ITEMS.filter((item) => item.featureFlag).map((item) => ({ href: item.href, featureFlag: item.featureFlag as string })),
  ...EXTRA_ROUTE_FEATURES,
];

function matchesHref(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Feature flag required to view `pathname`, or `undefined` when the route is not flag-gated. Segment-aware (`/attendance-devices` is not under `/attendance`) and longest-match wins. */
export function getRouteFeature(pathname: string): string | undefined {
  let best: { href: string; featureFlag: string } | undefined;
  for (const entry of ROUTE_FEATURES) {
    if (matchesHref(pathname, entry.href) && (!best || entry.href.length > best.href.length)) best = entry;
  }
  return best?.featureFlag;
}
