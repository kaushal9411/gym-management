import { z } from 'zod';

const roleNameSchema = z
  .string()
  .trim()
  .min(2, 'Role name must be at least 2 characters')
  .max(60)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/, 'Letters, numbers, spaces, hyphens and underscores only');

const permissionKeySchema = z.string().trim().min(3).max(80);

export const createRoleSchema = z.object({
  name: roleNameSchema,
  description: z.string().trim().max(300).optional(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
  isDefault: z.boolean().optional(),
  permissions: z.array(permissionKeySchema).max(2000).default([]),
});

export const updateRoleSchema = z
  .object({
    name: roleNameSchema.optional(),
    description: z.string().trim().max(300).optional(),
    priority: z.coerce.number().int().min(0).max(1000).optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    permissions: z.array(permissionKeySchema).max(2000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

export const cloneRoleSchema = z.object({
  name: roleNameSchema.optional(),
});

export const roleIdParamSchema = z.object({
  roleId: z.string().uuid(),
});
