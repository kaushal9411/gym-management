import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { requireModuleEnabled } from '../../tenants/middleware/require-module-enabled.middleware';
import { devicePunchController } from '../controllers/device-punch.controller';
import { authenticateDeviceMiddleware } from '../middlewares/authenticate-device.middleware';
import { devicePunchSchema } from '../validators/attendance-device.validators';

export const devicePunchRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

devicePunchRouter.use(requireModuleEnabled('attendance'));
devicePunchRouter.use(authenticateDeviceMiddleware);

/**
 * @openapi
 * /attendance-devices/punches:
 *   post:
 *     tags: [Attendance Devices]
 *     summary: Record one fingerprint/biometric punch — called by the device itself or a local bridge agent, authenticated by X-Device-Key (not a user token)
 *     parameters:
 *       - in: header
 *         name: X-Device-Key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201: { description: Attendance record created/updated (check-in or check-out, auto-toggled) }
 *       401: { description: Missing/invalid/disabled device key }
 *       404: { description: No member enrolled with this device user ID }
 *       409: { description: Member not eligible, already checked in, or no open check-in to close }
 */
devicePunchRouter.post('/', validate({ body: devicePunchSchema }), asyncHandler(devicePunchController.punch.bind(devicePunchController)));
