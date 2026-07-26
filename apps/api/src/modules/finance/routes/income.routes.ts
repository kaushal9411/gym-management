import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { incomeController } from '../controllers/income.controller';
import { createIncomeSchema, idParamSchema, listIncomeQuerySchema, updateIncomeSchema } from '../validators/finance.validators';

export const incomeRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

incomeRouter.use(authenticateMiddleware);

/** @openapi { "/income/export": { get: { tags: [Finance], summary: "Download filtered income as CSV", security: [{bearerAuth: []}], responses: { 200: { description: CSV file } } } } } */
incomeRouter.get('/export', requirePermission('finance:view'), asyncHandler(incomeController.exportCsv.bind(incomeController)));

/** @openapi { "/income/export/excel": { get: { tags: [Finance], summary: "Download filtered income as an Excel workbook", security: [{bearerAuth: []}], responses: { 200: { description: XLSX file } } } } } */
incomeRouter.get('/export/excel', requirePermission('finance:view'), asyncHandler(incomeController.exportExcel.bind(incomeController)));

/**
 * @openapi
 * /income:
 *   get:
 *     tags: [Finance]
 *     summary: Paginated income ledger with search + filters (category, branch, date range)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ items, total, page, limit, totalPages }" }
 */
incomeRouter.get('/', requirePermission('finance:view'), validate({ query: listIncomeQuerySchema }), asyncHandler(incomeController.list.bind(incomeController)));

/** @openapi { "/income": { post: { tags: [Finance], summary: "Record an income entry", security: [{bearerAuth: []}], responses: { 201: { description: Income recorded } } } } } */
incomeRouter.post('/', requirePermission('finance:income-manage'), validate({ body: createIncomeSchema }), asyncHandler(incomeController.create.bind(incomeController)));

/** @openapi { "/income/{id}": { get: { tags: [Finance], summary: "One income entry's details", security: [{bearerAuth: []}], responses: { 200: { description: Income } } } } } */
incomeRouter.get('/:id', requirePermission('finance:view'), validate({ params: idParamSchema }), asyncHandler(incomeController.getById.bind(incomeController)));

/** @openapi { "/income/{id}": { patch: { tags: [Finance], summary: "Update an income entry", security: [{bearerAuth: []}], responses: { 200: { description: Income updated } } } } } */
incomeRouter.patch(
  '/:id',
  requirePermission('finance:income-manage'),
  validate({ params: idParamSchema, body: updateIncomeSchema }),
  asyncHandler(incomeController.update.bind(incomeController)),
);

/** @openapi { "/income/{id}": { delete: { tags: [Finance], summary: "Soft-delete an income entry", security: [{bearerAuth: []}], responses: { 200: { description: Income deleted } } } } } */
incomeRouter.delete(
  '/:id',
  requirePermission('finance:income-manage'),
  validate({ params: idParamSchema }),
  asyncHandler(incomeController.softDelete.bind(incomeController)),
);
