import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { profileController } from '../controllers/profile.controller';
import { updateProfileSchema } from '../validators/profile.validators';

export const profileRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

profileRouter.use(authenticateMiddleware);

/**
 * @openapi
 * /profile:
 *   get:
 *     tags: [Profile]
 *     summary: The current user's profile, roles, branch access, and notification preferences
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profile }
 *   patch:
 *     tags: [Profile]
 *     summary: Update own profile (name, phone, avatar, emergency contact, notification preferences)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profile updated }
 */
profileRouter.get('/', asyncHandler(profileController.get.bind(profileController)));
profileRouter.patch(
  '/',
  validate({ body: updateProfileSchema }),
  asyncHandler(profileController.update.bind(profileController)),
);
