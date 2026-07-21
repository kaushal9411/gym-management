import { z } from 'zod';

import { emailSchema, passwordSchema } from '../../authentication/validators/auth.validators';
import { STAFF_ROLE_NAMES } from '../dto/staff.dto';

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number');

const roleSchema = z.enum(STAFF_ROLE_NAMES);
const genderSchema = z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']);
const employmentTypeSchema = z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']);
const salaryTypeSchema = z.enum(['MONTHLY', 'HOURLY', 'DAILY', 'PER_SESSION']);
const workStatusSchema = z.enum(['WORKING', 'ON_LEAVE', 'NOTICE_PERIOD', 'TERMINATED']);
const employeeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9-]+$/, 'Employee ID can only contain letters, numbers, and hyphens');

export const listStaffQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(['PENDING_VERIFICATION', 'ACTIVE', 'LOCKED', 'SUSPENDED', 'DEACTIVATED']).optional(),
  role: roleSchema.optional(),
  workStatus: workStatusSchema.optional(),
  employmentType: employmentTypeSchema.optional(),
  branchId: z.string().uuid().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  sortBy: z.enum(['name', 'employeeId', 'joiningDate', 'createdAt', 'lastLoginAt']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const createStaffSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: emailSchema,
  phone: phoneSchema.optional(),
  employeeId: employeeIdSchema.optional(),
  role: roleSchema,
  primaryBranchId: z.string().uuid(),
  branchIds: z.array(z.string().uuid()).max(200).optional(),
  gender: genderSchema.optional(),
  dateOfBirth: z.string().datetime().optional(),
  joiningDate: z.string().datetime().optional(),
  addressLine: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(2000).optional(),
  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactPhone: phoneSchema.optional(),
  emergencyContactRelation: z.string().trim().max(60).optional(),
  employmentType: employmentTypeSchema.optional(),
  salaryType: salaryTypeSchema.optional(),
  salaryAmount: z.coerce.number().min(0).max(99_999_999.99).optional(),
  shift: z.string().trim().max(60).optional(),
  weeklyOff: z.string().trim().max(60).optional(),
  workStatus: workStatusSchema.optional(),
});

export const updateStaffSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    employeeId: employeeIdSchema.optional(),
    avatarUrl: z.string().max(200_000).nullable().optional(),
    gender: genderSchema.nullable().optional(),
    dateOfBirth: z.string().datetime().nullable().optional(),
    joiningDate: z.string().datetime().optional(),
    addressLine: z.string().trim().max(200).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
    state: z.string().trim().max(100).nullable().optional(),
    country: z.string().trim().max(100).nullable().optional(),
    postalCode: z.string().trim().max(20).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    emergencyContactName: z.string().trim().max(120).nullable().optional(),
    emergencyContactPhone: phoneSchema.nullable().optional(),
    emergencyContactRelation: z.string().trim().max(60).nullable().optional(),
    employmentType: employmentTypeSchema.optional(),
    salaryType: salaryTypeSchema.optional(),
    salaryAmount: z.coerce.number().min(0).max(99_999_999.99).nullable().optional(),
    shift: z.string().trim().max(60).nullable().optional(),
    weeklyOff: z.string().trim().max(60).nullable().optional(),
    workStatus: workStatusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

export const assignBranchesSchema = z.object({
  primaryBranchId: z.string().uuid(),
  branchIds: z.array(z.string().uuid()).min(1).max(200),
});

export const assignRoleSchema = z.object({
  role: roleSchema,
});

export const bulkStaffActionSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(500),
});

export const staffBulkImportSchema = z.object({
  rows: z
    .array(
      z.object({
        firstName: z.string().trim().min(1).max(80),
        lastName: z.string().trim().min(1).max(80),
        email: emailSchema,
        phone: z.string().trim().max(20).optional(),
        role: z.string().trim().max(20).optional(),
        primaryBranchName: z.string().trim().max(120).optional(),
        employeeId: z.string().trim().max(40).optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const staffIdParamSchema = z.object({
  staffId: z.string().uuid(),
});

export const lookupStaffActivationQuerySchema = z.object({
  token: z.string().min(10).max(200),
});

export const acceptStaffActivationSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});
