import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { requireBranchAccess } from '../../authentication/middlewares/branch-access.middleware';
import { requireModuleEnabled } from '../../tenants/middleware/require-module-enabled.middleware';
import { attendanceDeviceController } from '../controllers/attendance-device.controller';
import {
  createAttendanceDeviceSchema,
  deviceIdParamSchema,
  listAttendanceDevicesQuerySchema,
  updateAttendanceDeviceSchema,
} from '../validators/attendance-device.validators';

export const attendanceDeviceRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

attendanceDeviceRouter.use(authenticateMiddleware);
attendanceDeviceRouter.use(requireModuleEnabled('attendance'));

/**
 * @openapi
 * /attendance-devices:
 *   get:
 *     tags: [Attendance Devices]
 *     summary: List registered fingerprint/biometric readers (optionally filtered by branch)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "AttendanceDevice[]" }
 *   post:
 *     tags: [Attendance Devices]
 *     summary: Register a new device — the response includes the plaintext API key exactly once
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Device registered, with apiKey }
 */
attendanceDeviceRouter.get(
  '/',
  requirePermission('attendance-devices:manage'),
  validate({ query: listAttendanceDevicesQuerySchema }),
  asyncHandler(attendanceDeviceController.list.bind(attendanceDeviceController)),
);
attendanceDeviceRouter.post(
  '/',
  requirePermission('attendance-devices:manage'),
  requireBranchAccess('branchId'),
  validate({ body: createAttendanceDeviceSchema }),
  asyncHandler(attendanceDeviceController.create.bind(attendanceDeviceController)),
);

/**
 * @openapi
 * /attendance-devices/{deviceId}:
 *   get:
 *     tags: [Attendance Devices]
 *     summary: One device's detail
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Device detail }
 *   patch:
 *     tags: [Attendance Devices]
 *     summary: Rename, re-brand, or activate/disable a device
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Device updated }
 *   delete:
 *     tags: [Attendance Devices]
 *     summary: Soft-delete a device — its key stops working immediately
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Device removed }
 */
attendanceDeviceRouter.get(
  '/:deviceId',
  requirePermission('attendance-devices:manage'),
  validate({ params: deviceIdParamSchema }),
  asyncHandler(attendanceDeviceController.getById.bind(attendanceDeviceController)),
);
attendanceDeviceRouter.patch(
  '/:deviceId',
  requirePermission('attendance-devices:manage'),
  validate({ params: deviceIdParamSchema, body: updateAttendanceDeviceSchema }),
  asyncHandler(attendanceDeviceController.update.bind(attendanceDeviceController)),
);
attendanceDeviceRouter.delete(
  '/:deviceId',
  requirePermission('attendance-devices:manage'),
  validate({ params: deviceIdParamSchema }),
  asyncHandler(attendanceDeviceController.softDelete.bind(attendanceDeviceController)),
);

/** @openapi { "/attendance-devices/{deviceId}/regenerate-key": { post: { tags: [Attendance Devices], summary: "Rotate a device's API key — the old key stops working immediately, the new one is shown exactly once", security: [{bearerAuth: []}], responses: { 200: { description: "Device updated, with the new apiKey" } } } } } */
attendanceDeviceRouter.post(
  '/:deviceId/regenerate-key',
  requirePermission('attendance-devices:manage'),
  validate({ params: deviceIdParamSchema }),
  asyncHandler(attendanceDeviceController.regenerateKey.bind(attendanceDeviceController)),
);
