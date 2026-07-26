import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { scheduledReportController } from '../controllers/scheduled-report.controller';
import { createScheduledReportSchema, idParamSchema, updateScheduledReportSchema } from '../validators/reports.validators';

export const scheduledReportRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

scheduledReportRouter.use(authenticateMiddleware);

/** @openapi { "/reports/scheduled": { get: { tags: [Reports], summary: "List scheduled reports", security: [{bearerAuth: []}], responses: { 200: { description: "ScheduledReport[]" } } } } } */
scheduledReportRouter.get('/', requirePermission('reports:view'), asyncHandler(scheduledReportController.list.bind(scheduledReportController)));

/** @openapi { "/reports/scheduled": { post: { tags: [Reports], summary: "Create a scheduled report (daily/weekly/monthly email delivery)", security: [{bearerAuth: []}], responses: { 201: { description: Scheduled report created } } } } } */
scheduledReportRouter.post(
  '/',
  requirePermission('reports:export'),
  validate({ body: createScheduledReportSchema }),
  asyncHandler(scheduledReportController.create.bind(scheduledReportController)),
);

/** @openapi { "/reports/scheduled/{id}": { get: { tags: [Reports], summary: "One scheduled report's details", security: [{bearerAuth: []}], responses: { 200: { description: Scheduled report } } } } } */
scheduledReportRouter.get(
  '/:id',
  requirePermission('reports:view'),
  validate({ params: idParamSchema }),
  asyncHandler(scheduledReportController.getById.bind(scheduledReportController)),
);

/** @openapi { "/reports/scheduled/{id}": { patch: { tags: [Reports], summary: "Update a scheduled report", security: [{bearerAuth: []}], responses: { 200: { description: Scheduled report updated } } } } } */
scheduledReportRouter.patch(
  '/:id',
  requirePermission('reports:export'),
  validate({ params: idParamSchema, body: updateScheduledReportSchema }),
  asyncHandler(scheduledReportController.update.bind(scheduledReportController)),
);

/** @openapi { "/reports/scheduled/{id}/run-now": { post: { tags: [Reports], summary: "Trigger an on-demand run outside its normal schedule", security: [{bearerAuth: []}], responses: { 200: { description: Run recorded } } } } } */
scheduledReportRouter.post(
  '/:id/run-now',
  requirePermission('reports:export'),
  validate({ params: idParamSchema }),
  asyncHandler(scheduledReportController.runNow.bind(scheduledReportController)),
);

/** @openapi { "/reports/scheduled/{id}": { delete: { tags: [Reports], summary: "Delete a scheduled report", security: [{bearerAuth: []}], responses: { 200: { description: Scheduled report deleted } } } } } */
scheduledReportRouter.delete(
  '/:id',
  requirePermission('reports:export'),
  validate({ params: idParamSchema }),
  asyncHandler(scheduledReportController.remove.bind(scheduledReportController)),
);
