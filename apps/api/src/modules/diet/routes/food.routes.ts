import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { foodController } from '../controllers/food.controller';
import { createFoodSchema, idParamSchema, listFoodsQuerySchema, updateFoodSchema } from '../validators/diet.validators';

export const foodRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

foodRouter.use(authenticateMiddleware);

/** @openapi { "/foods/active": { get: { tags: [Diet], summary: "Unfiltered active-only food list — backs the food picker", security: [{bearerAuth: []}], responses: { 200: { description: "Food[]" } } } } } */
foodRouter.get('/active', requirePermission('diets:view'), asyncHandler(foodController.listActive.bind(foodController)));

/**
 * @openapi
 * /foods:
 *   get:
 *     tags: [Diet]
 *     summary: Paginated food library with search + filters (category, status)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ items, total, page, limit, totalPages }" }
 */
foodRouter.get('/', requirePermission('diets:view'), validate({ query: listFoodsQuerySchema }), asyncHandler(foodController.list.bind(foodController)));

/** @openapi { "/foods": { post: { tags: [Diet], summary: "Add a food to the library", security: [{bearerAuth: []}], responses: { 201: { description: Food created } } } } } */
foodRouter.post('/', requirePermission('diets:create'), validate({ body: createFoodSchema }), asyncHandler(foodController.create.bind(foodController)));

/** @openapi { "/foods/{id}": { get: { tags: [Diet], summary: "One food's details", security: [{bearerAuth: []}], responses: { 200: { description: Food } } } } } */
foodRouter.get('/:id', requirePermission('diets:view'), validate({ params: idParamSchema }), asyncHandler(foodController.getById.bind(foodController)));

/** @openapi { "/foods/{id}": { patch: { tags: [Diet], summary: "Update a food", security: [{bearerAuth: []}], responses: { 200: { description: Food updated } } } } } */
foodRouter.patch(
  '/:id',
  requirePermission('diets:update'),
  validate({ params: idParamSchema, body: updateFoodSchema }),
  asyncHandler(foodController.update.bind(foodController)),
);

/** @openapi { "/foods/{id}/restore": { post: { tags: [Diet], summary: "Restore a soft-deleted food", security: [{bearerAuth: []}], responses: { 200: { description: Food restored } } } } } */
foodRouter.post(
  '/:id/restore',
  requirePermission('diets:restore'),
  validate({ params: idParamSchema }),
  asyncHandler(foodController.restore.bind(foodController)),
);

/** @openapi { "/foods/{id}": { delete: { tags: [Diet], summary: "Soft-delete a food", security: [{bearerAuth: []}], responses: { 200: { description: Food deleted } } } } } */
foodRouter.delete(
  '/:id',
  requirePermission('diets:delete'),
  validate({ params: idParamSchema }),
  asyncHandler(foodController.softDelete.bind(foodController)),
);
