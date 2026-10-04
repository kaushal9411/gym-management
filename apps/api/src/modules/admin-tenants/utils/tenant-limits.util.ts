/**
 * Limit-override maths. `TenantLimit.max*` columns always hold the EFFECTIVE value that runtime enforcement reads
 * (member/staff/branch capacity checks); `TenantLimit.overrides` records which keys a super admin forced, so a plan
 * change re-applies them instead of overwriting them (see `applyOverridesToPlan`).
 */

export const LIMIT_KEYS = [
  'maxMembers',
  'maxStaff',
  'maxBranches',
  'maxManagers',
  'maxTrainers',
  'maxReceptionists',
  'maxStorageMb',
] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];

export const LIMIT_LABELS: Record<LimitKey, string> = {
  maxMembers: 'Members',
  maxStaff: 'Staff accounts (total)',
  maxBranches: 'Branches',
  maxManagers: 'Managers',
  maxTrainers: 'Trainers',
  maxReceptionists: 'Receptionists',
  maxStorageMb: 'Storage (MB)',
};

/** Sanity ceiling — platform "unlimited" plans already use 9999 (storage 51200 MB), so allow generous headroom. */
export const LIMIT_MAX_VALUE = 1_000_000;

export type LimitValues = Record<LimitKey, number>;
export type LimitOverrides = Partial<Record<LimitKey, number>>;

export function isLimitKey(key: string): key is LimitKey {
  return (LIMIT_KEYS as readonly string[]).includes(key);
}

/** Parses the stored JSON defensively — unknown keys / non-integers are dropped. */
export function parseOverrides(raw: unknown): LimitOverrides {
  const out: LimitOverrides = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isLimitKey(k) && typeof v === 'number' && Number.isInteger(v) && v >= 0) out[k] = v;
  }
  return out;
}

/** Plan values with every override laid on top — what gets written to the max* columns. */
export function applyOverridesToPlan(plan: LimitValues, overrides: LimitOverrides): LimitValues {
  const merged = { ...plan };
  for (const key of LIMIT_KEYS) {
    const o = overrides[key];
    if (o !== undefined) merged[key] = o;
  }
  return merged;
}

export interface LimitRow {
  key: LimitKey;
  label: string;
  planValue: number | null;
  override: number | null;
  effective: number | null;
}

/**
 * `plan` is null when the tenant has no subscription; `stored` is the current max* column snapshot (null if the
 * tenant has no TenantLimit row). effective = override ?? planValue ?? stored.
 */
export function buildLimitRows(
  plan: LimitValues | null,
  overrides: LimitOverrides,
  stored: LimitValues | null,
): LimitRow[] {
  return LIMIT_KEYS.map((key) => {
    const planValue = plan ? plan[key] : null;
    const override = overrides[key] ?? null;
    const effective = override ?? planValue ?? (stored ? stored[key] : null);
    return { key, label: LIMIT_LABELS[key], planValue, override, effective };
  });
}

/** Applies a PUT body (`null` clears) to the current overrides; returns the new overrides + per-key before/after for audit. */
export function applyOverrideChanges(
  current: LimitOverrides,
  changes: Partial<Record<LimitKey, number | null>>,
): {
  next: LimitOverrides;
  diff: Array<{ key: LimitKey; before: number | null; after: number | null }>;
} {
  const next: LimitOverrides = { ...current };
  const diff: Array<{ key: LimitKey; before: number | null; after: number | null }> = [];
  for (const key of LIMIT_KEYS) {
    if (!(key in changes)) continue;
    const value = changes[key];
    const before = current[key] ?? null;
    if (value === null || value === undefined) delete next[key];
    else next[key] = value;
    const after = next[key] ?? null;
    if (before !== after) diff.push({ key, before, after });
  }
  return { next, diff };
}
