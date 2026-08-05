import { z } from 'zod';

const weekDaySchema = z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm format');

export const idParamSchema = z.object({ id: z.string().uuid('Invalid id') });

export const createGroupClassSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  description: z.string().max(2000).optional(),
  trainerId: z.string().uuid().optional(),
  branchId: z.string().uuid('Branch is required'),
  capacity: z.coerce.number().int().positive().max(500),
  durationMinutes: z.coerce.number().int().positive().max(480),
  isActive: z.boolean().optional(),
});

export const updateGroupClassSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().max(2000).optional(),
  trainerId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().optional(),
  capacity: z.coerce.number().int().positive().max(500).optional(),
  durationMinutes: z.coerce.number().int().positive().max(480).optional(),
  isActive: z.boolean().optional(),
});

export const listGroupClassesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  branchId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().optional(),
  search: z.string().max(150).optional(),
  sortBy: z.enum(['name', 'createdAt']).default('name'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export const setScheduleSchema = z.object({
  slots: z
    .array(z.object({ dayOfWeek: weekDaySchema, startTime: timeSchema }))
    .max(7 * 10, 'Too many schedule slots'),
});

export const listSessionsQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  groupClassId: z.string().uuid().optional(),
  dateFrom: z.string().min(1, 'dateFrom is required'),
  dateTo: z.string().min(1, 'dateTo is required'),
});

export const generateSessionsSchema = z.object({
  daysAhead: z.coerce.number().int().positive().max(90).optional(),
});

export const createBookingSchema = z.object({
  sessionId: z.string().uuid('Session is required'),
  memberId: z.string().uuid('Member is required'),
});
