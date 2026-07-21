import { z } from 'zod';

import { emailSchema, passwordSchema } from '../../authentication/validators/auth.validators';

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number');

const branchAssignmentSchema = z.object({
  branchId: z.string().uuid(),
  isPrimary: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(['PENDING_VERIFICATION', 'ACTIVE', 'LOCKED', 'SUSPENDED', 'DEACTIVATED']).optional(),
  roleId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  lastLoginFrom: z.string().datetime().optional(),
  lastLoginTo: z.string().datetime().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  sortBy: z.enum(['name', 'email', 'createdAt', 'lastLoginAt']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: phoneSchema.optional(),
  password: passwordSchema,
  roleIds: z.array(z.string().uuid()).min(1, 'Assign at least one role').max(10),
  allBranches: z.boolean().optional(),
  branches: z.array(branchAssignmentSchema).max(200).optional(),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    avatarUrl: z.string().max(200_000).nullable().optional(),
    emergencyContactName: z.string().trim().max(120).nullable().optional(),
    emergencyContactPhone: phoneSchema.nullable().optional(),
    emergencyContactRelation: z.string().trim().max(60).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

export const setRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(1).max(10),
});

export const setBranchesSchema = z.object({
  allBranches: z.boolean(),
  branches: z.array(branchAssignmentSchema).max(200).default([]),
});

export const setPermissionOverridesSchema = z.object({
  overrides: z
    .array(z.object({ key: z.string().trim().min(3).max(80), mode: z.enum(['GRANT', 'DENY']) }))
    .max(2000),
});

export const bulkImportSchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(120),
        email: emailSchema,
        phone: z.string().trim().max(20).optional(),
        roleName: z.string().trim().max(60).optional(),
        password: z.string().max(128).optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const userIdParamSchema = z.object({
  userId: z.string().uuid(),
});
