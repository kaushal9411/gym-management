import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminFeatureFlagController } from '../controllers/admin-feature-flag.controller';
import { featureFlagKeyParamSchema, setFeatureFlagSchema } from '../validators/admin-feature-flag.validators';

export const adminFeatureFlagRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminFeatureFlagRouter.use(adminAuthenticateMiddleware, requireAdminPermission('feature-flags:manage'));

/** @openapi { "/admin/feature-flags": { get: { tags: [Admin Feature Flags], summary: List global module toggles, security: [{bearerAuth: []}], responses: { 200: { description: Feature flags } } } } } */
adminFeatureFlagRouter.get('/', asyncHandler(adminFeatureFlagController.list.bind(adminFeatureFlagController)));

/** @openapi { "/admin/feature-flags/{key}": { patch: { tags: [Admin Feature Flags], summary: Enable/Disable a module globally, security: [{bearerAuth: []}], responses: { 200: { description: Updated } } } } } */
adminFeatureFlagRouter.patch(
  '/:key',
  validate({ params: featureFlagKeyParamSchema, body: setFeatureFlagSchema }),
  asyncHandler(adminFeatureFlagController.setEnabled.bind(adminFeatureFlagController)),
);
