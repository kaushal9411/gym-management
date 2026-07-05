import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminNotificationController } from '../controllers/admin-notification.controller';
import { createAnnouncementSchema, createNotificationSchema, idParamSchema, setAnnouncementActiveSchema } from '../validators/admin-notification.validators';

export const adminNotificationRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminNotificationRouter.use(adminAuthenticateMiddleware, requireAdminPermission('notifications:send'));

/** @openapi { "/admin/notifications/announcements": { get: { tags: [Admin Notifications], summary: List announcements, security: [{bearerAuth: []}], responses: { 200: { description: Announcements } } } } } */
adminNotificationRouter.get('/announcements', asyncHandler(adminNotificationController.listAnnouncements.bind(adminNotificationController)));

/** @openapi { "/admin/notifications/announcements": { post: { tags: [Admin Notifications], summary: Create Announcement, security: [{bearerAuth: []}], responses: { 201: { description: Created } } } } } */
adminNotificationRouter.post(
  '/announcements',
  validate({ body: createAnnouncementSchema }),
  asyncHandler(adminNotificationController.createAnnouncement.bind(adminNotificationController)),
);

/** @openapi { "/admin/notifications/announcements/{id}/active": { patch: { tags: [Admin Notifications], summary: Activate/deactivate an announcement, security: [{bearerAuth: []}], responses: { 200: { description: Updated } } } } } */
adminNotificationRouter.patch(
  '/announcements/:id/active',
  validate({ params: idParamSchema, body: setAnnouncementActiveSchema }),
  asyncHandler(adminNotificationController.setAnnouncementActive.bind(adminNotificationController)),
);

/** @openapi { "/admin/notifications": { get: { tags: [Admin Notifications], summary: List global notifications, security: [{bearerAuth: []}], responses: { 200: { description: Notifications } } } } } */
adminNotificationRouter.get('/', asyncHandler(adminNotificationController.listNotifications.bind(adminNotificationController)));

/** @openapi { "/admin/notifications": { post: { tags: [Admin Notifications], summary: Create a Global Notification / Email / Push / Schedule, security: [{bearerAuth: []}], responses: { 201: { description: Created } } } } } */
adminNotificationRouter.post('/', validate({ body: createNotificationSchema }), asyncHandler(adminNotificationController.createNotification.bind(adminNotificationController)));

/** @openapi { "/admin/notifications/{id}/send": { post: { tags: [Admin Notifications], summary: Send a notification now, security: [{bearerAuth: []}], responses: { 200: { description: Sent } } } } } */
adminNotificationRouter.post('/:id/send', validate({ params: idParamSchema }), asyncHandler(adminNotificationController.send.bind(adminNotificationController)));
