/** Pure helpers for the tenant Overview tab (usage rows, MRR, timeline wording). Health lives in `tenant-health.util` (shared with the list). */

export interface HealthBreakdown {
  score: number;
  components: { engagement: number; billing: number; utilisation: number; support: number };
}

export interface UsageRow {
  key: string;
  label: string;
  used: number | null;
  limit: number | null;
  pct: number | null;
  overridden: boolean;
}

export function buildUsageRow(
  key: string,
  label: string,
  used: number | null,
  limit: number | null,
  overridden: boolean,
): UsageRow {
  const pct =
    used !== null && limit !== null && limit > 0 ? Math.round((used / limit) * 100) : null;
  return { key, label, used, limit, pct, overridden };
}

/** Monthly-normalised price (yearly / 12) — same MRR definition as the dashboard overview. Null unless ACTIVE. */
export function monthlyRecurring(
  sub: { status: string; billingCycle: string; priceMonthly: number; priceYearly: number } | null,
): number | null {
  if (!sub || sub.status !== 'ACTIVE') return null;
  return sub.billingCycle === 'YEARLY' ? sub.priceYearly / 12 : sub.priceMonthly;
}

export type TimelineFamily =
  'access' | 'subscription' | 'billing' | 'limits' | 'modules' | 'notes' | 'other';

const ACTION_TEXT: Record<string, [string, TimelineFamily]> = {
  'admin.tenant_status_changed': ['changed tenant status', 'access'],
  'admin.tenant_deleted': ['deleted the tenant', 'access'],
  'admin.tenant_owner_password_reset': ['sent an owner password reset', 'access'],
  'admin.tenant_impersonated': ['impersonated the owner', 'access'],
  'admin.tenant_trial_extended': ['extended the trial', 'subscription'],
  'admin.tenant_maintenance_changed': ['changed maintenance mode', 'access'],
  'admin.tenant_force_logout': ['forced logout of all users', 'access'],
  'admin.tenant_limits_overridden': ['changed limit overrides', 'limits'],
  'admin.tenant_module_toggled': ['toggled a module', 'modules'],
  'admin.tenant_note_added': ['added an internal note', 'notes'],
  'admin.tenant_note_deleted': ['deleted an internal note', 'notes'],
  'admin.tenant_tags_updated': ['updated tags', 'notes'],
};

export function describeAdminAction(action: string): { text: string; family: TimelineFamily } {
  const known = ACTION_TEXT[action];
  if (known) return { text: known[0], family: known[1] };
  const family: TimelineFamily = /subscription|plan|trial/.test(action)
    ? 'subscription'
    : /payment|invoice|billing/.test(action)
      ? 'billing'
      : 'other';
  return { text: action.replace(/^admin\./, '').replace(/_/g, ' '), family };
}
