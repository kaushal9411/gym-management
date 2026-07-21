import { z } from 'zod';

const attendanceMethodSchema = z.enum(['QR_CODE', 'MANUAL', 'BIOMETRIC', 'FACE_RECOGNITION', 'NFC', 'RFID']);
const attendanceStatusSchema = z.enum(['CHECKED_IN', 'CHECKED_OUT']);

export const attendanceParamSchema = z.object({ id: z.string().uuid() });
export const memberAttendanceParamSchema = z.object({ memberId: z.string().uuid() });
export const branchAttendanceParamSchema = z.object({ branchId: z.string().uuid() });

export const checkInSchema = z.object({
  memberId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  method: attendanceMethodSchema.optional(),
  deviceName: z.string().trim().max(120).optional(),
  deviceId: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const checkOutSchema = z
  .object({
    memberId: z.string().uuid().optional(),
    attendanceId: z.string().uuid().optional(),
    deviceName: z.string().trim().max(120).optional(),
    deviceId: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((v) => !!v.memberId || !!v.attendanceId, { message: 'Provide either memberId or attendanceId', path: ['memberId'] });

export const validateQrCodeSchema = z.object({
  qrCodeToken: z.string().trim().min(1),
});

export const listAttendanceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  branchId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  status: attendanceStatusSchema.optional(),
  method: attendanceMethodSchema.optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  sortBy: z.enum(['checkInTime', 'attendanceDate', 'createdAt']).default('checkInTime'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const summaryQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
});

export const updateAttendanceSchema = z.object({
  checkInTime: z.string().datetime().optional(),
  checkOutTime: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(2000).optional(),
  status: attendanceStatusSchema.optional(),
});
