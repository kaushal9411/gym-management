'use client';

import * as React from 'react';

import { useFeatureFlagSet } from '@/features/tenant/use-feature-flag';
import { PORTAL_NAV, portalRouteFlag, type PortalNavItem } from '../lib/nav';

/** `PORTAL_NAV` minus the items whose module is off for this gym (`tenant.featureFlags`; an absent key = module OFF). */
export function usePortalNav(): PortalNavItem[] {
  const flags = useFeatureFlagSet();
  return React.useMemo(() => PORTAL_NAV.filter((item) => !item.featureFlag || flags.has(item.featureFlag)), [flags]);
}

/** `false` when `pathname` belongs to a module that is switched off (the page must not render or fetch). */
export function usePortalRouteEnabled(pathname: string): boolean {
  const flags = useFeatureFlagSet();
  const flag = portalRouteFlag(pathname);
  return !flag || flags.has(flag);
}
