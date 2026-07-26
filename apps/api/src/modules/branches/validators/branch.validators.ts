import { z } from 'zod';

export const branchIdParamSchema = z.object({
  branchId: z.string().uuid(),
});

const branchCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9-]+$/, 'Branch code may only contain letters, numbers, and hyphens.');

/** Same {open, close, closed} shape as `TenantSettings.businessHours` (Prompt 12), one level down at the branch. */
const operatingHoursDaySchema = z.object({
  open: z.string().trim().max(10).nullable().optional(),
  close: z.string().trim().max(10).nullable().optional(),
  closed: z.boolean().default(false),
});

const operatingHoursSchema = z
  .object({
    monday: operatingHoursDaySchema.optional(),
    tuesday: operatingHoursDaySchema.optional(),
    wednesday: operatingHoursDaySchema.optional(),
    thursday: operatingHoursDaySchema.optional(),
    friday: operatingHoursDaySchema.optional(),
    saturday: operatingHoursDaySchema.optional(),
    sunday: operatingHoursDaySchema.optional(),
  })
  .strict();

const holidaySchema = z.object({
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  label: z.string().trim().max(120).optional(),
});

const branchFieldsSchema = {
  email: z.string().trim().toLowerCase().email().max(255).optional(),
  phone: z.string().trim().max(30).optional(),
  whatsappNumber: z.string().trim().max(30).optional(),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  timezone: z.string().trim().max(64).optional(),
  operatingHours: operatingHoursSchema.optional(),
  holidays: z.array(holidaySchema).max(100).optional(),
  capacity: z.coerce.number().int().min(0).max(1_000_000).optional(),
  maxMembers: z.coerce.number().int().min(0).max(1_000_000).optional(),
  maxStaff: z.coerce.number().int().min(0).max(1_000_000).optional(),
  allowCheckIn: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
};

export const listBranchesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  isActive: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  sortBy: z.enum(['name', 'branchCode', 'city', 'createdAt']).default('name'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export const createBranchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  branchCode: branchCodeSchema.optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  ...branchFieldsSchema,
});

export const updateBranchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  branchCode: branchCodeSchema.optional(),
  ...branchFieldsSchema,
});
