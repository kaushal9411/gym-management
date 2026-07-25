import { describe, expect, it } from 'vitest';

import {
  checkInSchema,
  checkOutSchema,
  listAttendanceQuerySchema,
  updateAttendanceSchema,
  validateQrCodeSchema,
} from './attendance.validators';

describe('attendance validators', () => {
  describe('checkInSchema', () => {
    it('accepts a minimal valid payload', () => {
      expect(checkInSchema.safeParse({ memberId: '11111111-1111-1111-1111-111111111111' }).success).toBe(true);
    });

    it('rejects a missing memberId', () => {
      expect(checkInSchema.safeParse({}).success).toBe(false);
    });

    it('rejects an unknown attendance method', () => {
      const result = checkInSchema.safeParse({
        memberId: '11111111-1111-1111-1111-111111111111',
        method: 'FINGERPRINT',
      });
      expect(result.success).toBe(false);
    });

    it('accepts every currently-supported method, including not-yet-wired-up ones', () => {
      for (const method of ['QR_CODE', 'MANUAL', 'BIOMETRIC', 'FACE_RECOGNITION', 'NFC', 'RFID']) {
        const result = checkInSchema.safeParse({ memberId: '11111111-1111-1111-1111-111111111111', method });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('checkOutSchema', () => {
    it('accepts memberId alone', () => {
      expect(checkOutSchema.safeParse({ memberId: '11111111-1111-1111-1111-111111111111' }).success).toBe(true);
    });

    it('accepts attendanceId alone', () => {
      expect(checkOutSchema.safeParse({ attendanceId: '11111111-1111-1111-1111-111111111111' }).success).toBe(true);
    });

    it('rejects an empty body (neither memberId nor attendanceId)', () => {
      expect(checkOutSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('validateQrCodeSchema', () => {
    it('rejects an empty token', () => {
      expect(validateQrCodeSchema.safeParse({ qrCodeToken: '' }).success).toBe(false);
    });

    it('accepts a non-empty token', () => {
      expect(validateQrCodeSchema.safeParse({ qrCodeToken: 'fitcloud-member:tenant:token' }).success).toBe(true);
    });
  });

  describe('listAttendanceQuerySchema', () => {
    it('applies defaults for an empty query', () => {
      const result = listAttendanceQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sortBy).toBe('checkInTime');
      expect(result.sortDir).toBe('desc');
      expect(result.includeDeleted).toBe(false);
    });

    it('coerces string page/limit query params', () => {
      const result = listAttendanceQuerySchema.safeParse({ page: '2', limit: '50' });
      expect(result.success).toBe(true);
    });

    it('rejects a limit above the max page size', () => {
      expect(listAttendanceQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
    });

    it('rejects an unknown sortBy column', () => {
      expect(listAttendanceQuerySchema.safeParse({ sortBy: 'memberName' }).success).toBe(false);
    });
  });

  describe('updateAttendanceSchema', () => {
    it('allows explicit null to clear checkOutTime', () => {
      expect(updateAttendanceSchema.safeParse({ checkOutTime: null }).success).toBe(true);
    });

    it('rejects a non-ISO checkInTime', () => {
      expect(updateAttendanceSchema.safeParse({ checkInTime: '22-07-2026' }).success).toBe(false);
    });

    it('accepts a single-field partial update', () => {
      expect(updateAttendanceSchema.safeParse({ notes: 'Left early' }).success).toBe(true);
    });
  });
});
