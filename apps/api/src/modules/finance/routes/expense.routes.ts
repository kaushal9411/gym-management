import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { expenseController } from '../controllers/expense.controller';
import { createExpenseSchema, idParamSchema, listExpensesQuerySchema, updateExpenseSchema } from '../validators/finance.validators';

export const expenseRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

expenseRouter.use(authenticateMiddleware);

/** @openapi { "/expenses/export": { get: { tags: [Finance], summary: "Download filtered expenses as CSV", security: [{bearerAuth: []}], responses: { 200: { description: CSV file } } } } } */
expenseRouter.get('/export', requirePermission('finance:view'), asyncHandler(expenseController.exportCsv.bind(expenseController)));

/** @openapi { "/expenses/export/excel": { get: { tags: [Finance], summary: "Download filtered expenses as an Excel workbook", security: [{bearerAuth: []}], responses: { 200: { description: XLSX file } } } } } */
expenseRouter.get('/export/excel', requirePermission('finance:view'), asyncHandler(expenseController.exportExcel.bind(expenseController)));

/**
 * @openapi
 * /expenses:
 *   get:
 *     tags: [Finance]
 *     summary: Paginated expense ledger with search + filters (category, branch, date range)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ items, total, page, limit, totalPages }" }
 */
expenseRouter.get('/', requirePermission('finance:view'), validate({ query: listExpensesQuerySchema }), asyncHandler(expenseController.list.bind(expenseController)));

/** @openapi { "/expenses": { post: { tags: [Finance], summary: "Record an expense (optionally with a receipt data-URL)", security: [{bearerAuth: []}], responses: { 201: { description: Expense recorded } } } } } */
expenseRouter.post(
  '/',
  requirePermission('finance:expense-manage'),
  validate({ body: createExpenseSchema }),
  asyncHandler(expenseController.create.bind(expenseController)),
);

/** @openapi { "/expenses/{id}": { get: { tags: [Finance], summary: "One expense's details", security: [{bearerAuth: []}], responses: { 200: { description: Expense } } } } } */
expenseRouter.get('/:id', requirePermission('finance:view'), validate({ params: idParamSchema }), asyncHandler(expenseController.getById.bind(expenseController)));

/** @openapi { "/expenses/{id}": { patch: { tags: [Finance], summary: "Update an expense (including uploading/replacing its receipt)", security: [{bearerAuth: []}], responses: { 200: { description: Expense updated } } } } } */
expenseRouter.patch(
  '/:id',
  requirePermission('finance:expense-manage'),
  validate({ params: idParamSchema, body: updateExpenseSchema }),
  asyncHandler(expenseController.update.bind(expenseController)),
);

/** @openapi { "/expenses/{id}": { delete: { tags: [Finance], summary: "Soft-delete an expense", security: [{bearerAuth: []}], responses: { 200: { description: Expense deleted } } } } } */
expenseRouter.delete(
  '/:id',
  requirePermission('finance:expense-manage'),
  validate({ params: idParamSchema }),
  asyncHandler(expenseController.softDelete.bind(expenseController)),
);
