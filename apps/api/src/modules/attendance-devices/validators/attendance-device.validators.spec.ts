import { describe, expect, it } from 'vitest';

import { createAttendanceDeviceSchema, devicePunchSchema, listAttendanceDevicesQuerySchema, updateAttendanceDeviceSchema } from './attendance-device.validators';

describe('attendance-device validators', () => {
  describe('createAttendanceDeviceSchema', () => {
    it('accepts a minimal valid payload', () => {
      const result = createAttendanceDeviceSchema.safeParse({ branchId: '11111111-1111-1111-1111-111111111111', name: 'Front Desk Reader' });
      expect(result.success).toBe(true);
    });

    it('defaults vendor to undefined when omitted (service defaults to GENERIC)', () => {
      const result = createAttendanceDeviceSchema.parse({ branchId: '11111111-1111-1111-1111-111111111111', name: 'Front Desk Reader' });
      expect(result.vendor).toBeUndefined();
    });

    it('accepts every known vendor', () => {
      for (const vendor of ['ZKTECO', 'ESSL', 'GENERIC', 'OTHER']) {
        const result = createAttendanceDeviceSchema.safeParse({ branchId: '11111111-1111-1111-1111-111111111111', name: 'Reader', vendor });
        expect(result.success).toBe(true);
      }
    });

    it('rejects an unknown vendor', () => {
      const result = createAttendanceDeviceSchema.safeParse({ branchId: '11111111-1111-1111-1111-111111111111', name: 'Reader', vendor: 'SUPREMA' });
      expect(result.success).toBe(false);
    });

    it('rejects a missing branchId', () => {
      expect(createAttendanceDeviceSchema.safeParse({ name: 'Reader' }).success).toBe(false);
    });

    it('rejects an empty name', () => {
      expect(createAttendanceDeviceSchema.safeParse({ branchId: '11111111-1111-1111-1111-111111111111', name: '' }).success).toBe(false);
    });
  });

  describe('updateAttendanceDeviceSchema', () => {
    it('accepts a single-field partial update', () => {
      expect(updateAttendanceDeviceSchema.safeParse({ isActive: false }).success).toBe(true);
    });

    it('accepts an empty body', () => {
      expect(updateAttendanceDeviceSchema.safeParse({}).success).toBe(true);
    });
  });

  describe('listAttendanceDevicesQuerySchema', () => {
    it('accepts an empty query', () => {
      expect(listAttendanceDevicesQuerySchema.safeParse({}).success).toBe(true);
    });

    it('coerces a string isActive query param', () => {
      const result = listAttendanceDevicesQuerySchema.safeParse({ isActive: 'true' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.isActive).toBe(true);
    });
  });

  describe('devicePunchSchema', () => {
    it('accepts the minimal shape (deviceUserId only)', () => {
      expect(devicePunchSchema.safeParse({ deviceUserId: '42' }).success).toBe(true);
    });

    it('accepts an explicit direction and ISO timestamp', () => {
      const result = devicePunchSchema.safeParse({ deviceUserId: '42', direction: 'IN', timestamp: '2026-10-02T09:00:00.000Z' });
      expect(result.success).toBe(true);
    });

    it('rejects a missing deviceUserId', () => {
      expect(devicePunchSchema.safeParse({}).success).toBe(false);
    });

    it('rejects an unknown direction', () => {
      expect(devicePunchSchema.safeParse({ deviceUserId: '42', direction: 'SIDEWAYS' }).success).toBe(false);
    });

    it('rejects a non-ISO timestamp', () => {
      expect(devicePunchSchema.safeParse({ deviceUserId: '42', timestamp: '02-10-2026' }).success).toBe(false);
    });
  });
});
