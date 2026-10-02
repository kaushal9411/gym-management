import { z } from 'zod';

const vendorSchema = z.enum(['ZKTECO', 'ESSL', 'GENERIC', 'OTHER']);

export const deviceIdParamSchema = z.object({
  deviceId: z.string().uuid(),
});

export const listAttendanceDevicesQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const createAttendanceDeviceSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  vendor: vendorSchema.optional(),
});

export const updateAttendanceDeviceSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  vendor: vendorSchema.optional(),
  isActive: z.boolean().optional(),
});

/** Body a device/bridge agent sends on every punch — see `DevicePunchInput`'s doc comment. */
export const devicePunchSchema = z.object({
  deviceUserId: z.string().trim().min(1).max(40),
  timestamp: z.string().datetime({ offset: true }).optional(),
  direction: z.enum(['IN', 'OUT']).optional(),
});
