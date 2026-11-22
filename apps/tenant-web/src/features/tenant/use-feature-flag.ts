'use client';

import * as React from 'react';

import { useTenant } from './tenant-provider';

/**
 * Module kill-switch lookups against `tenant.featureFlags` (plan-granted AND platform-enabled; an absent key = module OFF).
 * The tenant is the source of truth; pass `extraDisabled` (e.g. the API's `disabledModules`) to additionally hide modules the
 * server already reported as off. Never throws; safe to call in any component under `TenantProvider`.
 */
export function useFeatureFlagSet(extraDisabled?: readonly string[] | null): ReadonlySet<string> {
  const { featureFlags } = useTenant();
  return React.useMemo(() => {
    const set = new Set(featureFlags);
    for (const key of extraDisabled ?? []) set.delete(key);
    return set;
  }, [featureFlags, extraDisabled]);
}

/** `true` when the module `flag` is enabled for this tenant. */
export function useFeatureEnabled(flag: string): boolean {
  return useFeatureFlagSet().has(flag);
}
