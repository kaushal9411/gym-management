import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminAiAssistantController } from '../controllers/admin-ai-assistant.controller';
import {
  conversationIdParamSchema,
  listConversationsQuerySchema,
  sendMessageBodySchema,
  streamMessageBodySchema,
  updatePlatformAiSettingsBodySchema,
} from '../validators/admin-ai-assistant.validators';

export const adminAiAssistantRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminAiAssistantRouter.use(adminAuthenticateMiddleware, requireAdminPermission('dashboard:read'));

/** @openapi { "/admin/ai/config": { get: { tags: [Admin AI Assistant], summary: Get AI Configuration, security: [{bearerAuth: []}], responses: { 200: { description: Provider/model config (no secrets) } } } } } */
adminAiAssistantRouter.get('/config', asyncHandler(adminAiAssistantController.getConfig.bind(adminAiAssistantController)));

/** @openapi { "/admin/ai/settings": { get: { tags: [Admin AI Assistant], summary: Get the platform-wide AI provider override, security: [{bearerAuth: []}], responses: { 200: { description: Masked settings } } } } } */
adminAiAssistantRouter.get('/settings', asyncHandler(adminAiAssistantController.getSettings.bind(adminAiAssistantController)));

/** @openapi { "/admin/ai/settings": { put: { tags: [Admin AI Assistant], summary: Update the platform-wide AI provider override, security: [{bearerAuth: []}], responses: { 200: { description: Updated } } } } } */
adminAiAssistantRouter.put(
  '/settings',
  requireAdminPermission('settings:manage'),
  validate({ body: updatePlatformAiSettingsBodySchema }),
  asyncHandler(adminAiAssistantController.updateSettings.bind(adminAiAssistantController)),
);

/** @openapi { "/admin/ai/settings": { delete: { tags: [Admin AI Assistant], summary: Revert to the environment-variable AI configuration, security: [{bearerAuth: []}], responses: { 200: { description: Reset } } } } } */
adminAiAssistantRouter.delete(
  '/settings',
  requireAdminPermission('settings:manage'),
  asyncHandler(adminAiAssistantController.resetSettings.bind(adminAiAssistantController)),
);

/** @openapi { "/admin/ai/conversations": { get: { tags: [Admin AI Assistant], summary: List conversations, security: [{bearerAuth: []}], responses: { 200: { description: Paginated conversations } } } } } */
adminAiAssistantRouter.get(
  '/conversations',
  validate({ query: listConversationsQuerySchema }),
  asyncHandler(adminAiAssistantController.listConversations.bind(adminAiAssistantController)),
);

/** @openapi { "/admin/ai/conversations": { post: { tags: [Admin AI Assistant], summary: Start a new conversation, security: [{bearerAuth: []}], responses: { 201: { description: Created } } } } } */
adminAiAssistantRouter.post('/conversations', asyncHandler(adminAiAssistantController.createConversation.bind(adminAiAssistantController)));

/** @openapi { "/admin/ai/conversations/{id}": { get: { tags: [Admin AI Assistant], summary: Get conversation + messages, security: [{bearerAuth: []}], responses: { 200: { description: Conversation } } } } } */
adminAiAssistantRouter.get(
  '/conversations/:id',
  validate({ params: conversationIdParamSchema }),
  asyncHandler(adminAiAssistantController.getConversation.bind(adminAiAssistantController)),
);

/** @openapi { "/admin/ai/conversations/{id}": { delete: { tags: [Admin AI Assistant], summary: Delete conversation, security: [{bearerAuth: []}], responses: { 200: { description: Deleted } } } } } */
adminAiAssistantRouter.delete(
  '/conversations/:id',
  validate({ params: conversationIdParamSchema }),
  asyncHandler(adminAiAssistantController.deleteConversation.bind(adminAiAssistantController)),
);

/** @openapi { "/admin/ai/conversations/{id}/clear": { post: { tags: [Admin AI Assistant], summary: Clear conversation messages, security: [{bearerAuth: []}], responses: { 200: { description: Cleared } } } } } */
adminAiAssistantRouter.post(
  '/conversations/:id/clear',
  validate({ params: conversationIdParamSchema }),
  asyncHandler(adminAiAssistantController.clearConversation.bind(adminAiAssistantController)),
);

/** @openapi { "/admin/ai/conversations/{id}/messages": { post: { tags: [Admin AI Assistant], summary: Send Message (non-streaming), security: [{bearerAuth: []}], responses: { 201: { description: Assistant reply } } } } } */
adminAiAssistantRouter.post(
  '/conversations/:id/messages',
  validate({ params: conversationIdParamSchema, body: sendMessageBodySchema }),
  asyncHandler(adminAiAssistantController.sendMessage.bind(adminAiAssistantController)),
);

/** @openapi { "/admin/ai/conversations/{id}/messages/stream": { post: { tags: [Admin AI Assistant], summary: "Stream Response (SSE) — also backs Regenerate via {regenerate:true}", security: [{bearerAuth: []}], responses: { 200: { description: text/event-stream } } } } } */
adminAiAssistantRouter.post(
  '/conversations/:id/messages/stream',
  validate({ params: conversationIdParamSchema, body: streamMessageBodySchema }),
  asyncHandler(adminAiAssistantController.streamMessage.bind(adminAiAssistantController)),
);
