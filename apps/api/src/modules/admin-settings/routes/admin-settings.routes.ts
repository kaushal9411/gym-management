import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminSettingsController } from '../controllers/admin-settings.controller';
import { settingKeyParamSchema, upsertSettingSchema } from '../validators/admin-settings.validators';

export const adminSettingsRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminSettingsRouter.use(adminAuthenticateMiddleware, requireAdminPermission('settings:manage'));

/** @openapi { "/admin/settings": { get: { tags: [Admin Settings], summary: List system settings (optionally by category), security: [{bearerAuth: []}], responses: { 200: { description: Settings } } } } } */
adminSettingsRouter.get('/', asyncHandler(adminSettingsController.list.bind(adminSettingsController)));

/** @openapi { "/admin/settings/{key}": { get: { tags: [Admin Settings], summary: Get one setting, security: [{bearerAuth: []}], responses: { 200: { description: Setting } } } } } */
adminSettingsRouter.get('/:key', validate({ params: settingKeyParamSchema }), asyncHandler(adminSettingsController.get.bind(adminSettingsController)));

/** @openapi { "/admin/settings/{key}": { put: { tags: [Admin Settings], summary: Create or update a setting, security: [{bearerAuth: []}], responses: { 200: { description: Saved } } } } } */
adminSettingsRouter.put(
  '/:key',
  validate({ params: settingKeyParamSchema, body: upsertSettingSchema }),
  asyncHandler(adminSettingsController.upsert.bind(adminSettingsController)),
);
