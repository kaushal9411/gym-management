import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { aiAssistantController } from '../controllers/ai-assistant.controller';
import {
  conversationIdParamSchema,
  listConversationsQuerySchema,
  messageParamSchema,
  sendMessageBodySchema,
  streamMessageBodySchema,
} from '../validators/ai-assistant.validators';

export const aiAssistantRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

aiAssistantRouter.use(authenticateMiddleware, requirePermission('ai:use'));

/** @openapi { "/ai/config": { get: { tags: [AI Assistant], summary: Get AI Configuration, security: [{bearerAuth: []}], responses: { 200: { description: Provider/model config (no secrets) } } } } } */
aiAssistantRouter.get('/config', asyncHandler(aiAssistantController.getConfig.bind(aiAssistantController)));

/** @openapi { "/ai/conversations": { get: { tags: [AI Assistant], summary: Get Conversation History (list), security: [{bearerAuth: []}], responses: { 200: { description: Paginated conversations } } } } } */
aiAssistantRouter.get(
  '/conversations',
  validate({ query: listConversationsQuerySchema }),
  asyncHandler(aiAssistantController.listConversations.bind(aiAssistantController)),
);

/** @openapi { "/ai/conversations": { post: { tags: [AI Assistant], summary: Start a new conversation, security: [{bearerAuth: []}], responses: { 201: { description: Created } } } } } */
aiAssistantRouter.post('/conversations', asyncHandler(aiAssistantController.createConversation.bind(aiAssistantController)));

/** @openapi { "/ai/conversations/{id}": { get: { tags: [AI Assistant], summary: Get Conversation History (messages), security: [{bearerAuth: []}], responses: { 200: { description: Conversation + messages } } } } } */
aiAssistantRouter.get(
  '/conversations/:id',
  validate({ params: conversationIdParamSchema }),
  asyncHandler(aiAssistantController.getConversation.bind(aiAssistantController)),
);

/** @openapi { "/ai/conversations/{id}": { delete: { tags: [AI Assistant], summary: Delete Conversation, security: [{bearerAuth: []}], responses: { 200: { description: Deleted } } } } } */
aiAssistantRouter.delete(
  '/conversations/:id',
  validate({ params: conversationIdParamSchema }),
  asyncHandler(aiAssistantController.deleteConversation.bind(aiAssistantController)),
);

/** @openapi { "/ai/conversations/{id}/clear": { post: { tags: [AI Assistant], summary: Clear Conversation (keep the conversation, delete its messages), security: [{bearerAuth: []}], responses: { 200: { description: Cleared } } } } } */
aiAssistantRouter.post(
  '/conversations/:id/clear',
  validate({ params: conversationIdParamSchema }),
  asyncHandler(aiAssistantController.clearConversation.bind(aiAssistantController)),
);

/** @openapi { "/ai/conversations/{id}/messages": { post: { tags: [AI Assistant], summary: Send Message (non-streaming), security: [{bearerAuth: []}], responses: { 201: { description: Assistant reply } } } } } */
aiAssistantRouter.post(
  '/conversations/:id/messages',
  validate({ params: conversationIdParamSchema, body: sendMessageBodySchema }),
  asyncHandler(aiAssistantController.sendMessage.bind(aiAssistantController)),
);

/** @openapi { "/ai/conversations/{id}/messages/stream": { post: { tags: [AI Assistant], summary: "Stream Response (SSE) — also backs Regenerate Response via {regenerate:true}", security: [{bearerAuth: []}], responses: { 200: { description: text/event-stream } } } } } */
aiAssistantRouter.post(
  '/conversations/:id/messages/stream',
  validate({ params: conversationIdParamSchema, body: streamMessageBodySchema }),
  asyncHandler(aiAssistantController.streamMessage.bind(aiAssistantController)),
);

/** @openapi { "/ai/conversations/{id}/actions/{messageId}/confirm": { post: { tags: [AI Assistant], summary: Confirm and execute a proposed AI action, security: [{bearerAuth: []}], responses: { 200: { description: Action result } } } } } */
aiAssistantRouter.post(
  '/conversations/:id/actions/:messageId/confirm',
  validate({ params: messageParamSchema }),
  asyncHandler(aiAssistantController.confirmAction.bind(aiAssistantController)),
);

/** @openapi { "/ai/conversations/{id}/actions/{messageId}/cancel": { post: { tags: [AI Assistant], summary: Cancel a proposed AI action, security: [{bearerAuth: []}], responses: { 200: { description: Cancelled } } } } } */
aiAssistantRouter.post(
  '/conversations/:id/actions/:messageId/cancel',
  validate({ params: messageParamSchema }),
  asyncHandler(aiAssistantController.cancelAction.bind(aiAssistantController)),
);
