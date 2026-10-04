import { describe, expect, it } from 'vitest';

import {
  extendTrialBodySchema,
  maintenanceBodySchema,
} from '../validators/admin-tenant.validators';

import {
  assertMaintenanceChange,
  assertTrialExtendable,
  computeExtendedTrialEnd,
} from './tenant-controls.util';

const now = new Date('2026-10-01T00:00:00Z');

describe('computeExtendedTrialEnd', () => {
  it('extends from the current end when it is in the future', () => {
    expect(computeExtendedTrialEnd(new Date('2026-10-05T00:00:00Z'), 7, now).toISOString()).toBe(
      '2026-10-12T00:00:00.000Z',
    );
  });
  it('extends from now when the trial already lapsed or is unset', () => {
    expect(computeExtendedTrialEnd(new Date('2026-09-01T00:00:00Z'), 3, now).toISOString()).toBe(
      '2026-10-04T00:00:00.000Z',
    );
    expect(computeExtendedTrialEnd(null, 1, now).toISOString()).toBe('2026-10-02T00:00:00.000Z');
  });
});

describe('state validation', () => {
  it('rejects non-trial tenants with 422 and deleted ones with 404', () => {
    expect(() => assertTrialExtendable({ status: 'ACTIVE', deletedAt: null })).toThrowError(
      expect.objectContaining({ httpStatus: 422 }),
    );
    expect(() => assertTrialExtendable({ status: 'TRIAL', deletedAt: new Date() })).toThrowError(
      expect.objectContaining({ httpStatus: 404 }),
    );
    expect(() => assertTrialExtendable({ status: 'TRIAL', deletedAt: null })).not.toThrow();
  });
  it('maintenance no-op toggle is a 409', () => {
    expect(() => assertMaintenanceChange(true, true)).toThrowError(
      expect.objectContaining({ httpStatus: 409 }),
    );
    expect(() => assertMaintenanceChange(false, true)).not.toThrow();
  });
});

describe('body schemas', () => {
  it('days must be an int 1..90', () => {
    expect(extendTrialBodySchema.safeParse({ days: 0 }).success).toBe(false);
    expect(extendTrialBodySchema.safeParse({ days: 91 }).success).toBe(false);
    expect(extendTrialBodySchema.safeParse({ days: 1.5 }).success).toBe(false);
    expect(extendTrialBodySchema.safeParse({ days: 90, reason: 'x'.repeat(201) }).success).toBe(
      false,
    );
    expect(extendTrialBodySchema.safeParse({ days: 14, reason: 'ok' }).success).toBe(true);
  });
  it('maintenance requires boolean enabled', () => {
    expect(maintenanceBodySchema.safeParse({ enabled: 'yes' }).success).toBe(false);
    expect(maintenanceBodySchema.safeParse({ enabled: false }).success).toBe(true);
  });
});
