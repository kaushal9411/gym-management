import { z } from 'zod';

export const templateKeyParamSchema = z.object({ key: z.string().trim().min(1).max(80) });

export const upsertEmailTemplateSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  bodyHtml: z.string().trim().min(1),
  variables: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export const upsertSmsTemplateSchema = z.object({
  body: z.string().trim().min(1).max(320),
  variables: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});
