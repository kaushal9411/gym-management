import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
  permissionKeys: z.array(z.string()).default([]),
});

export const updateRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string()),
});

export const roleIdParamSchema = z.object({ roleId: z.string().uuid() });

export const createAdminSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  roleId: z.string().uuid(),
});

export const updateAdminRoleSchema = z.object({ roleId: z.string().uuid() });

export const setAdminStatusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']) });

export const adminIdParamSchema = z.object({ adminId: z.string().uuid() });

export const listAdminsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
