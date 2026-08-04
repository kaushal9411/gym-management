import { z } from 'zod';

export const listConversationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const conversationIdParamSchema = z.object({ id: z.string().uuid() });

export const messageParamSchema = z.object({ id: z.string().uuid(), messageId: z.string().uuid() });

export const sendMessageBodySchema = z.object({
  content: z.string().trim().min(1).max(8000),
});

export const streamMessageBodySchema = z
  .object({
    content: z.string().trim().min(1).max(8000).optional(),
    regenerate: z.boolean().optional().default(false),
  })
  .refine((data) => data.regenerate || !!data.content, { message: 'content is required unless regenerate is true' });

const AI_PROVIDERS = ['openrouter', 'openai', 'anthropic', 'gemini', 'azure-openai', 'ollama'] as const;

/** Every field optional — omitted = leave unchanged, `''` = clear back to the platform default (see `AiTenantSettingsService#update`). */
export const updateTenantAiSettingsBodySchema = z.object({
  provider: z.union([z.enum(AI_PROVIDERS), z.literal('')]).optional(),
  model: z.string().trim().max(120).optional(),
  apiKey: z.string().trim().max(500).optional(),
  baseUrl: z.string().trim().max(500).optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  maxTokens: z.coerce.number().int().positive().max(32_000).optional(),
});
