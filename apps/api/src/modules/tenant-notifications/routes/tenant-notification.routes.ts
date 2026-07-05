import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { tenantNotificationController } from '../controllers/tenant-notification.controller';
import { listNotificationsQuerySchema, notificationIdParamSchema } from '../validators/tenant-notification.validators';

export const tenantNotificationRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

tenantNotificationRouter.use(authenticateMiddleware);

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Tenant Notifications]
 *     summary: Notification Center feed — unread + read, paginated
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: "{ items, unreadCount, page, limit, total, totalPages }" }
 */
tenantNotificationRouter.get('/', validate({ query: listNotificationsQuerySchema }), asyncHandler(tenantNotificationController.list.bind(tenantNotificationController)));

/** @openapi { "/notifications/{notificationId}/read": { post: { tags: [Tenant Notifications], summary: Mark one notification read, security: [{bearerAuth: []}], responses: { 200: { description: Marked read } } } } } */
tenantNotificationRouter.post(
  '/:notificationId/read',
  validate({ params: notificationIdParamSchema }),
  asyncHandler(tenantNotificationController.markRead.bind(tenantNotificationController)),
);

/** @openapi { "/notifications/read-all": { post: { tags: [Tenant Notifications], summary: Mark every notification read, security: [{bearerAuth: []}], responses: { 200: { description: All marked read } } } } } */
tenantNotificationRouter.post('/read-all', asyncHandler(tenantNotificationController.markAllRead.bind(tenantNotificationController)));
