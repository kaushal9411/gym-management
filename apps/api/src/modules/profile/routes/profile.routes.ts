import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { twoFactorConfirmSchema, twoFactorDisableSchema } from '../../authentication/validators/auth.validators';
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

/**
 * @openapi
 * /profile/two-factor/setup:
 *   post:
 *     tags: [Profile]
 *     summary: Begin TOTP 2FA setup — generates a new secret + QR code (not yet active until confirmed)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ secret, otpauthUri, qrDataUrl }" }
 */
profileRouter.post('/two-factor/setup', asyncHandler(profileController.beginTwoFactorSetup.bind(profileController)));

/**
 * @openapi
 * /profile/two-factor/setup/confirm:
 *   post:
 *     tags: [Profile]
 *     summary: Confirm 2FA setup with a code from the authenticator app — enables 2FA and returns one-time backup codes
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [code], properties: { code: { type: string, example: "123456" } } }
 *     responses:
 *       200: { description: "{ backupCodes: string[] }" }
 *       401: { description: "Incorrect code" }
 */
profileRouter.post(
  '/two-factor/setup/confirm',
  validate({ body: twoFactorConfirmSchema }),
  asyncHandler(profileController.confirmTwoFactorSetup.bind(profileController)),
);

/**
 * @openapi
 * /profile/two-factor/disable:
 *   post:
 *     tags: [Profile]
 *     summary: Disable 2FA — requires re-entering the current password
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [password], properties: { password: { type: string } } }
 *     responses:
 *       200: { description: 2FA disabled }
 *       422: { description: "Password incorrect" }
 */
profileRouter.post(
  '/two-factor/disable',
  validate({ body: twoFactorDisableSchema }),
  asyncHandler(profileController.disableTwoFactor.bind(profileController)),
);

/**
 * @openapi
 * /profile/two-factor/backup-codes/regenerate:
 *   post:
 *     tags: [Profile]
 *     summary: Regenerate backup codes — invalidates old ones, requires a current TOTP code
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [code], properties: { code: { type: string } } }
 *     responses:
 *       200: { description: "{ backupCodes: string[] }" }
 */
profileRouter.post(
  '/two-factor/backup-codes/regenerate',
  validate({ body: twoFactorConfirmSchema }),
  asyncHandler(profileController.regenerateBackupCodes.bind(profileController)),
);
