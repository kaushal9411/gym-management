import { z } from 'zod';

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number');

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    phone: phoneSchema.nullable().optional(),
    /**
     * URL or small data-URL. 200KB keeps a base64 avatar comfortably under
     * the 1MB JSON body limit while the platform has no object storage.
     */
    avatarUrl: z.string().max(200_000).nullable().optional(),
    emergencyContactName: z.string().trim().max(120).nullable().optional(),
    emergencyContactPhone: phoneSchema.nullable().optional(),
    emergencyContactRelation: z.string().trim().max(60).nullable().optional(),
    notificationPreferences: z.record(z.boolean()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });
