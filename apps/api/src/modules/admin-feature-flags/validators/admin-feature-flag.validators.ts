import { z } from 'zod';

export const featureFlagKeyParamSchema = z.object({ key: z.string().trim().min(1).max(60) });
export const setFeatureFlagSchema = z.object({ enabled: z.boolean() });
