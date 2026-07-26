import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { reportsController } from '../controllers/reports.controller';
import { exportQuerySchema, reportFiltersQuerySchema, reportTypeParamSchema } from '../validators/reports.validators';

export const reportsRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

reportsRouter.use(authenticateMiddleware);

/** @openapi { "/reports/membership": { get: { tags: [Reports], summary: "Membership Report — members with plan/status/dates", security: [{bearerAuth: []}], responses: { 200: { description: Paginated membership rows } } } } } */
reportsRouter.get('/membership', requirePermission('reports:view'), validate({ query: reportFiltersQuerySchema }), asyncHandler(reportsController.membership.bind(reportsController)));

/** @openapi { "/reports/attendance": { get: { tags: [Reports], summary: "Attendance Report", security: [{bearerAuth: []}], responses: { 200: { description: Paginated attendance rows } } } } } */
reportsRouter.get('/attendance', requirePermission('reports:view'), validate({ query: reportFiltersQuerySchema }), asyncHandler(reportsController.attendance.bind(reportsController)));

/** @openapi { "/reports/revenue": { get: { tags: [Reports], summary: "Revenue Report", security: [{bearerAuth: []}], responses: { 200: { description: Paginated revenue rows + total } } } } } */
reportsRouter.get('/revenue', requirePermission('reports:view'), validate({ query: reportFiltersQuerySchema }), asyncHandler(reportsController.revenue.bind(reportsController)));

/** @openapi { "/reports/expenses": { get: { tags: [Reports], summary: "Expense Report", security: [{bearerAuth: []}], responses: { 200: { description: Paginated expense rows + total } } } } } */
reportsRouter.get('/expenses', requirePermission('reports:view'), validate({ query: reportFiltersQuerySchema }), asyncHandler(reportsController.expenses.bind(reportsController)));

/** @openapi { "/reports/payments": { get: { tags: [Reports], summary: "Payment Report", security: [{bearerAuth: []}], responses: { 200: { description: Paginated payment rows } } } } } */
reportsRouter.get('/payments', requirePermission('reports:view'), validate({ query: reportFiltersQuerySchema }), asyncHandler(reportsController.payments.bind(reportsController)));

/** @openapi { "/reports/staff": { get: { tags: [Reports], summary: "Staff Report", security: [{bearerAuth: []}], responses: { 200: { description: Paginated staff rows } } } } } */
reportsRouter.get('/staff', requirePermission('reports:view'), validate({ query: reportFiltersQuerySchema }), asyncHandler(reportsController.staff.bind(reportsController)));

/** @openapi { "/reports/trainer-performance": { get: { tags: [Reports], summary: "Trainer Performance Report", security: [{bearerAuth: []}], responses: { 200: { description: "TrainerPerformanceRow[]" } } } } } */
reportsRouter.get(
  '/trainer-performance',
  requirePermission('reports:view'),
  validate({ query: reportFiltersQuerySchema }),
  asyncHandler(reportsController.trainerPerformance.bind(reportsController)),
);

/** @openapi { "/reports/member-progress": { get: { tags: [Reports], summary: "Member Progress Report", security: [{bearerAuth: []}], responses: { 200: { description: Paginated member-progress rows } } } } } */
reportsRouter.get(
  '/member-progress',
  requirePermission('reports:view'),
  validate({ query: reportFiltersQuerySchema }),
  asyncHandler(reportsController.memberProgress.bind(reportsController)),
);

/** @openapi { "/reports/branch-performance": { get: { tags: [Reports], summary: "Branch Performance Report", security: [{bearerAuth: []}], responses: { 200: { description: "BranchPerformanceRow[]" } } } } } */
reportsRouter.get(
  '/branch-performance',
  requirePermission('reports:view'),
  validate({ query: reportFiltersQuerySchema }),
  asyncHandler(reportsController.branchPerformance.bind(reportsController)),
);

/** @openapi { "/reports/expiring-memberships": { get: { tags: [Reports], summary: "Expiring Membership Report", security: [{bearerAuth: []}], responses: { 200: { description: Paginated expiring-membership rows } } } } } */
reportsRouter.get(
  '/expiring-memberships',
  requirePermission('reports:view'),
  validate({ query: reportFiltersQuerySchema }),
  asyncHandler(reportsController.expiringMemberships.bind(reportsController)),
);

/** @openapi { "/reports/active-vs-inactive": { get: { tags: [Reports], summary: "Active vs Inactive Members Report", security: [{bearerAuth: []}], responses: { 200: { description: "ActiveVsInactiveRow[]" } } } } } */
reportsRouter.get(
  '/active-vs-inactive',
  requirePermission('reports:view'),
  validate({ query: reportFiltersQuerySchema }),
  asyncHandler(reportsController.activeVsInactive.bind(reportsController)),
);

/** @openapi { "/reports/{reportType}/export": { get: { tags: [Reports], summary: "Export any report/analytics type as CSV, Excel, or PDF", security: [{bearerAuth: []}], responses: { 200: { description: "File download" } } } } } */
reportsRouter.get(
  '/:reportType/export',
  requirePermission('reports:export'),
  validate({ params: reportTypeParamSchema, query: exportQuerySchema }),
  asyncHandler(reportsController.export.bind(reportsController)),
);
