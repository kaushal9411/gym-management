import { z } from 'zod';

export const upsertSettingSchema = z.object({
  category: z.string().trim().min(1).max(60),
  value: z.unknown(),
});

export const settingKeyParamSchema = z.object({ key: z.string().trim().min(1).max(100) });
