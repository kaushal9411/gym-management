export interface PermissionOverride {
  key: string;
  mode: 'GRANT' | 'DENY';
}

/**
 * The IAM permission-resolution rule, kept pure so it's directly testable:
 *   effective = union(role permission keys) + GRANT overrides − DENY overrides
 * DENY always wins, including over a GRANT of the same key.
 */
export function mergeEffectivePermissions(
  rolePermissionKeys: Iterable<string>,
  overrides: PermissionOverride[],
): string[] {
  const keys = new Set<string>(rolePermissionKeys);
  for (const override of overrides) {
    if (override.mode === 'GRANT') keys.add(override.key);
  }
  for (const override of overrides) {
    if (override.mode === 'DENY') keys.delete(override.key);
  }
  return [...keys];
}
