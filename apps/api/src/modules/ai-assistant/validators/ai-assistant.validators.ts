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
