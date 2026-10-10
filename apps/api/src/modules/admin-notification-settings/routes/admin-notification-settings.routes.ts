import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminNotificationSettingsController } from '../controllers/admin-notification-settings.controller';
import { updatePlatformNotificationCredentialSchema } from '../validators/admin-notification-settings.validators';

export const adminNotificationSettingsRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminNotificationSettingsRouter.use(adminAuthenticateMiddleware, requireAdminPermission('notification-settings:manage'));

/** @openapi { "/admin/notification-settings": { get: { tags: [Admin Notification Settings], summary: "Platform-wide SMTP/Kaleyra credentials (secrets masked)", security: [{bearerAuth: []}], responses: { 200: { description: Credentials view } } } } } */
adminNotificationSettingsRouter.get('/', asyncHandler(adminNotificationSettingsController.getCredentials.bind(adminNotificationSettingsController)));

/** @openapi { "/admin/notification-settings": { patch: { tags: [Admin Notification Settings], summary: "Update platform-wide SMTP/Kaleyra credentials — omit a secret field to leave it untouched, send '' to clear it", security: [{bearerAuth: []}], responses: { 200: { description: Updated } } } } } */
adminNotificationSettingsRouter.patch(
  '/',
  validate({ body: updatePlatformNotificationCredentialSchema }),
  asyncHandler(adminNotificationSettingsController.updateCredentials.bind(adminNotificationSettingsController)),
);
