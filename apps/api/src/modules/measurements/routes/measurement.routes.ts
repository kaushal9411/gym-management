import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { measurementController } from '../controllers/measurement.controller';
import {
  createBodyMeasurementSchema,
  idParamSchema,
  memberIdParamSchema,
  updateBodyMeasurementSchema,
} from '../validators/measurement.validators';

export const measurementRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

measurementRouter.use(authenticateMiddleware);

/** @openapi { "/measurements/members": { get: { tags: [Measurements], summary: "Every member who has at least one measurement entry, each with their latest reading + a total count — backs the Body Measurements list page (deliberately not the full member roster)", security: [{bearerAuth: []}], responses: { 200: { description: "MeasuredMember[]" } } } } } */
measurementRouter.get(
  '/members',
  requirePermission('measurements:view'),
  asyncHandler(measurementController.listMembers.bind(measurementController)),
);

/** @openapi { "/measurements/members/{memberId}": { get: { tags: [Measurements], summary: "A member's body measurement history, newest first", security: [{bearerAuth: []}], responses: { 200: { description: "BodyMeasurement[]" } } } } } */
measurementRouter.get(
  '/members/:memberId',
  requirePermission('measurements:view'),
  validate({ params: memberIdParamSchema }),
  asyncHandler(measurementController.listForMember.bind(measurementController)),
);

/** @openapi { "/measurements/members/{memberId}": { post: { tags: [Measurements], summary: "Log a new body measurement entry for a member — trainer/owner/manager only", security: [{bearerAuth: []}], responses: { 201: { description: Measurement recorded } } } } } */
measurementRouter.post(
  '/members/:memberId',
  requirePermission('measurements:create'),
  validate({ params: memberIdParamSchema, body: createBodyMeasurementSchema }),
  asyncHandler(measurementController.create.bind(measurementController)),
);

/** @openapi { "/measurements/{id}": { patch: { tags: [Measurements], summary: "Edit an existing body measurement entry", security: [{bearerAuth: []}], responses: { 200: { description: Measurement updated } } } } } */
measurementRouter.patch(
  '/:id',
  requirePermission('measurements:update'),
  validate({ params: idParamSchema, body: updateBodyMeasurementSchema }),
  asyncHandler(measurementController.update.bind(measurementController)),
);

/** @openapi { "/measurements/{id}": { delete: { tags: [Measurements], summary: "Delete a body measurement entry", security: [{bearerAuth: []}], responses: { 200: { description: Deleted } } } } } */
measurementRouter.delete(
  '/:id',
  requirePermission('measurements:delete'),
  validate({ params: idParamSchema }),
  asyncHandler(measurementController.remove.bind(measurementController)),
);
