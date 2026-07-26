import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { tenantNotificationController } from '../controllers/tenant-notification.controller';
import { createNotificationSchema, listNotificationsQuerySchema, notificationIdParamSchema } from '../validators/tenant-notification.validators';

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
tenantNotificationRouter.get(
  '/',
  requirePermission('notifications:view'),
  validate({ query: listNotificationsQuerySchema }),
  asyncHandler(tenantNotificationController.list.bind(tenantNotificationController)),
);

/** @openapi { "/notifications/unread-count": { get: { tags: [Tenant Notifications], summary: Unread notification count, security: [{bearerAuth: []}], responses: { 200: { description: "{ unreadCount }" } } } } } */
tenantNotificationRouter.get('/unread-count', requirePermission('notifications:view'), asyncHandler(tenantNotificationController.unreadCount.bind(tenantNotificationController)));

/** @openapi { "/notifications/read-all": { post: { tags: [Tenant Notifications], summary: Mark every notification read, security: [{bearerAuth: []}], responses: { 200: { description: All marked read } } } } } */
tenantNotificationRouter.post('/read-all', requirePermission('notifications:view'), asyncHandler(tenantNotificationController.markAllRead.bind(tenantNotificationController)));

/** @openapi { "/notifications": { post: { tags: [Tenant Notifications], summary: Create an ad-hoc notification, security: [{bearerAuth: []}], responses: { 201: { description: Created } } } } } */
tenantNotificationRouter.post(
  '/',
  requirePermission('notifications:manage'),
  validate({ body: createNotificationSchema }),
  asyncHandler(tenantNotificationController.create.bind(tenantNotificationController)),
);

/** @openapi { "/notifications/{notificationId}/read": { post: { tags: [Tenant Notifications], summary: Mark one notification read, security: [{bearerAuth: []}], responses: { 200: { description: Marked read } } } } } */
tenantNotificationRouter.post(
  '/:notificationId/read',
  requirePermission('notifications:view'),
  validate({ params: notificationIdParamSchema }),
  asyncHandler(tenantNotificationController.markRead.bind(tenantNotificationController)),
);

/** @openapi { "/notifications/{notificationId}": { get: { tags: [Tenant Notifications], summary: Notification details, security: [{bearerAuth: []}], responses: { 200: { description: OK } } } } } */
tenantNotificationRouter.get(
  '/:notificationId',
  requirePermission('notifications:view'),
  validate({ params: notificationIdParamSchema }),
  asyncHandler(tenantNotificationController.getById.bind(tenantNotificationController)),
);

/** @openapi { "/notifications/{notificationId}": { delete: { tags: [Tenant Notifications], summary: Delete a notification, security: [{bearerAuth: []}], responses: { 200: { description: Deleted } } } } } */
tenantNotificationRouter.delete(
  '/:notificationId',
  requirePermission('notifications:manage'),
  validate({ params: notificationIdParamSchema }),
  asyncHandler(tenantNotificationController.remove.bind(tenantNotificationController)),
);
