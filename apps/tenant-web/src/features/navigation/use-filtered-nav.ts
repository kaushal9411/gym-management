'use client';

import * as React from 'react';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useTenant } from '@/features/tenant/tenant-provider';
import { NAV_ITEMS, type NavItem } from './nav-config';

/**
 * Sidebar entries visible to the current user: permission-gated (RBAC/PBAC)
 * AND feature-flag-gated (subscription plan). Both must pass; either check
 * is skipped when the item doesn't declare it.
 */
export function useFilteredNav(): NavItem[] {
  const { hasPermission, hasAnyPermission } = usePermissions();
  const tenant = useTenant();

  return React.useMemo(
    () =>
      NAV_ITEMS.filter((item) => {
        if (item.permission) {
          const allowed = Array.isArray(item.permission)
            ? hasAnyPermission(item.permission)
            : hasPermission(item.permission);
          if (!allowed) return false;
        }
        if (item.featureFlag && !tenant.featureFlags.includes(item.featureFlag)) return false;
        return true;
      }).map((item) => {
        if (!item.children) return item;
        // Sub-links follow the same any-of permission rule; a child without its own `permission` inherits the parent's visibility.
        const children = item.children.filter((child) => {
          if (!child.permission) return true;
          return Array.isArray(child.permission) ? hasAnyPermission(child.permission) : hasPermission(child.permission);
        });
        return { ...item, children };
      }),
    [hasPermission, hasAnyPermission, tenant.featureFlags],
  );
}
