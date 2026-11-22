'use client';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { useKpis } from '@/features/reports/hooks/use-reports';
import { useFeatureFlagSet } from '@/features/tenant/use-feature-flag';

/**
 * Which modules the dashboard may show and query. `tenant.featureFlags` is the source of truth (an absent key = module OFF);
 * `kpis.disabledModules` (additive, from the API) can only hide MORE. Each panel gates itself by the flag of the endpoint it calls
 * so no request is fired that the API would answer with 403 "This module is currently unavailable.":
 *  - `dashboard`  -> /reports/dashboard/*  (KPIs, recent activity)
 *  - `reports`    -> /analytics/* and /reports/<type>  (trend charts, expiring list, trainer load, branch comparison)
 *  - `payments`   -> /invoices  (outstanding list)
 *  - `notifications` -> /announcements/active
 */
export function useDashboardModules() {
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const tenantFlags = useFeatureFlagSet();
  const kpisEnabled = tenantFlags.has('dashboard') && hasPermission('reports:view');
  const kpis = useKpis(currentBranchId ?? undefined, kpisEnabled);
  const flags = useFeatureFlagSet(kpis.data?.disabledModules);
  return {
    /** `true` when the module is on for this gym (and the API did not report it as disabled). */
    has: (flag: string) => flags.has(flag),
    kpis: kpis.data,
    kpisLoading: kpisEnabled && kpis.isPending,
    /** Whether the dashboard KPI endpoint is callable (module on + permission). */
    kpisEnabled,
  };
}

export type DashboardPanelKey =
  | 'money'
  | 'members'
  | 'attendance'
  | 'newMembers'
  | 'expiring'
  | 'outstanding'
  | 'activity'
  | 'branch'
  | 'staff'
  | 'health'
  | 'announcements'
  | 'birthdays'
  | 'plan';

/**
 * Single source of truth for which dashboard panels render (module flag of the endpoint each panel calls + the permission that
 * endpoint needs). The page uses it to reflow the grid, and each panel uses it to skip rendering AND querying, so a hidden
 * panel never fires a request and the grid never has a hole.
 */
export function useDashboardPanels(): Record<DashboardPanelKey, boolean> {
  const { hasPermission } = usePermissions();
  const { has, kpisEnabled } = useDashboardModules();
  const analytics = has('reports') && hasPermission('analytics:view');
  const reportsData = has('reports') && hasPermission('reports:view');
  return {
    money: analytics && has('income') && has('expenses'),
    members: kpisEnabled,
    attendance: analytics && has('attendance'),
    newMembers: analytics,
    expiring: reportsData,
    outstanding: has('payments') && hasPermission('finance:view'),
    activity: kpisEnabled,
    branch: analytics,
    staff: kpisEnabled || reportsData,
    health: kpisEnabled || (reportsData && analytics && has('payments')),
    announcements: has('notifications'),
    birthdays: true,
    plan: true,
  };
}
