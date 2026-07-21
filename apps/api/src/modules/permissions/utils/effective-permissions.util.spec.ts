import { describe, expect, it } from 'vitest';

import { mergeEffectivePermissions } from './effective-permissions.util';

describe('mergeEffectivePermissions', () => {
  it('returns the union of role permissions when there are no overrides', () => {
    const result = mergeEffectivePermissions(['members:read', 'members:manage', 'members:read'], []);
    expect(result.sort()).toEqual(['members:manage', 'members:read']);
  });

  it('adds GRANT overrides on top of role permissions', () => {
    const result = mergeEffectivePermissions(['members:read'], [{ key: 'payments:refund', mode: 'GRANT' }]);
    expect(result.sort()).toEqual(['members:read', 'payments:refund']);
  });

  it('removes DENY overrides even when a role grants the key', () => {
    const result = mergeEffectivePermissions(
      ['members:read', 'payments:refund'],
      [{ key: 'payments:refund', mode: 'DENY' }],
    );
    expect(result).toEqual(['members:read']);
  });

  it('lets DENY win over a GRANT of the same key regardless of order', () => {
    const result = mergeEffectivePermissions(
      [],
      [
        { key: 'reports:read', mode: 'DENY' },
        { key: 'reports:read', mode: 'GRANT' },
      ],
    );
    expect(result).toEqual([]);
  });

  it('handles an empty everything', () => {
    expect(mergeEffectivePermissions([], [])).toEqual([]);
  });
});
