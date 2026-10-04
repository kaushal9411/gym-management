/** Module-toggle rules. `TenantModule.enabled` feeds `ResolvedTenant.featureFlags`, which `requireModuleEnabled(key)` reads. */

/**
 * Keys a super admin may NOT disable: the tenant's day-to-day shell depends on them (landing dashboard, core member /
 * staff / branch administration). Disabling any of these would effectively brick the tenant app, so use suspend or
 * maintenance mode instead. (Auth and settings are not modules, so they cannot be switched off at all.)
 */
export const GUARDED_MODULE_KEYS = ['dashboard', 'members', 'staff', 'branches'] as const;

export function isGuardedModule(key: string): boolean {
  return (GUARDED_MODULE_KEYS as readonly string[]).includes(key);
}

export function moduleLabel(key: string, planLabel?: string | null): string {
  if (planLabel) return planLabel;
  return key
    .split('_')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Returns an error message when the toggle is refused, else null. */
export function moduleToggleError(key: string, enabled: boolean): string | null {
  if (!enabled && isGuardedModule(key)) {
    return `The "${key}" module is core to the tenant app and cannot be disabled. Suspend the tenant or enable maintenance mode instead.`;
  }
  return null;
}

/** An override exists only while the forced value differs from what the plan grants. */
export function isModuleOverridden(enabled: boolean, planDefault: boolean): boolean {
  return enabled !== planDefault;
}
