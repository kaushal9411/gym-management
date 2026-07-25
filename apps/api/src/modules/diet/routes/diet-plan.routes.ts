import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { dietPlanController } from '../controllers/diet-plan.controller';
import {
  assignDietPlanSchema,
  assignmentIdParamSchema,
  createDietPlanSchema,
  idParamSchema,
  listDietPlansQuerySchema,
  memberIdParamSchema,
  setPlanMealsSchema,
  updateDietPlanSchema,
  updateDietProgressSchema,
  updateMemberDietPlanSchema,
} from '../validators/diet.validators';

export const dietPlanRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

dietPlanRouter.use(authenticateMiddleware);

/** @openapi { "/diet-plans/assignable": { get: { tags: [Diet], summary: "Unfiltered active-only plan list — backs the Assign Diet Plan dropdown", security: [{bearerAuth: []}], responses: { 200: { description: "DietPlan[]" } } } } } */
dietPlanRouter.get('/assignable', requirePermission('diets:view'), asyncHandler(dietPlanController.listAssignable.bind(dietPlanController)));

/** @openapi { "/diet-plans/members/{memberId}": { get: { tags: [Diet], summary: "A member's current + historical diet plan assignments", security: [{bearerAuth: []}], responses: { 200: { description: "{ current, history }" } } } } } */
dietPlanRouter.get(
  '/members/:memberId',
  requirePermission('diets:view'),
  validate({ params: memberIdParamSchema }),
  asyncHandler(dietPlanController.getMemberDietPlans.bind(dietPlanController)),
);

/** @openapi { "/diet-plans/assignments/{assignmentId}/remove": { post: { tags: [Diet], summary: "Remove (cancel) an active diet plan assignment — preserves it as history", security: [{bearerAuth: []}], responses: { 200: { description: Removed } } } } } */
dietPlanRouter.post(
  '/assignments/:assignmentId/remove',
  requirePermission('diets:assign'),
  validate({ params: assignmentIdParamSchema }),
  asyncHandler(dietPlanController.remove.bind(dietPlanController)),
);

/** @openapi { "/diet-plans/assignments/{assignmentId}/progress": { post: { tags: [Diet], summary: "Update one day's diet progress (water intake, weight, per-meal status) for a member's assignment", security: [{bearerAuth: []}], responses: { 200: { description: Assignment with updated progress } } } } } */
dietPlanRouter.post(
  '/assignments/:assignmentId/progress',
  requirePermission('diets:progress'),
  validate({ params: assignmentIdParamSchema, body: updateDietProgressSchema }),
  asyncHandler(dietPlanController.updateProgress.bind(dietPlanController)),
);

/** @openapi { "/diet-plans/assignments/{assignmentId}": { patch: { tags: [Diet], summary: "Update an assignment's dates/trainer remarks/member notes", security: [{bearerAuth: []}], responses: { 200: { description: Assignment updated } } } } } */
dietPlanRouter.patch(
  '/assignments/:assignmentId',
  requirePermission('diets:update'),
  validate({ params: assignmentIdParamSchema, body: updateMemberDietPlanSchema }),
  asyncHandler(dietPlanController.updateAssignment.bind(dietPlanController)),
);

/**
 * @openapi
 * /diet-plans:
 *   get:
 *     tags: [Diet]
 *     summary: Paginated diet plan list with search + filters (trainer, status)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ items, total, page, limit, totalPages }" }
 */
dietPlanRouter.get(
  '/',
  requirePermission('diets:view'),
  validate({ query: listDietPlansQuerySchema }),
  asyncHandler(dietPlanController.list.bind(dietPlanController)),
);

/** @openapi { "/diet-plans": { post: { tags: [Diet], summary: "Create a diet plan — trainerId, if given, must be an active Trainer", security: [{bearerAuth: []}], responses: { 201: { description: Diet plan created } } } } } */
dietPlanRouter.post(
  '/',
  requirePermission('diets:create'),
  validate({ body: createDietPlanSchema }),
  asyncHandler(dietPlanController.create.bind(dietPlanController)),
);

/** @openapi { "/diet-plans/{id}": { get: { tags: [Diet], summary: "One diet plan's details, including its meal builder", security: [{bearerAuth: []}], responses: { 200: { description: Diet plan } } } } } */
dietPlanRouter.get(
  '/:id',
  requirePermission('diets:view'),
  validate({ params: idParamSchema }),
  asyncHandler(dietPlanController.getById.bind(dietPlanController)),
);

/** @openapi { "/diet-plans/{id}": { patch: { tags: [Diet], summary: "Update a diet plan", security: [{bearerAuth: []}], responses: { 200: { description: Diet plan updated } } } } } */
dietPlanRouter.patch(
  '/:id',
  requirePermission('diets:update'),
  validate({ params: idParamSchema, body: updateDietPlanSchema }),
  asyncHandler(dietPlanController.update.bind(dietPlanController)),
);

/** @openapi { "/diet-plans/{id}/meals": { patch: { tags: [Diet], summary: "Replace a plan's whole meal builder (array order = sort order per meal type)", security: [{bearerAuth: []}], responses: { 200: { description: Diet plan updated } } } } } */
dietPlanRouter.patch(
  '/:id/meals',
  requirePermission('diets:update'),
  validate({ params: idParamSchema, body: setPlanMealsSchema }),
  asyncHandler(dietPlanController.setMeals.bind(dietPlanController)),
);

/** @openapi { "/diet-plans/{id}/activate": { post: { tags: [Diet], summary: "Activate a diet plan", security: [{bearerAuth: []}], responses: { 200: { description: Activated } } } } } */
dietPlanRouter.post(
  '/:id/activate',
  requirePermission('diets:update'),
  validate({ params: idParamSchema }),
  asyncHandler(dietPlanController.activate.bind(dietPlanController)),
);

/** @openapi { "/diet-plans/{id}/deactivate": { post: { tags: [Diet], summary: "Deactivate a diet plan", security: [{bearerAuth: []}], responses: { 200: { description: Deactivated } } } } } */
dietPlanRouter.post(
  '/:id/deactivate',
  requirePermission('diets:update'),
  validate({ params: idParamSchema }),
  asyncHandler(dietPlanController.deactivate.bind(dietPlanController)),
);

/** @openapi { "/diet-plans/{id}/restore": { post: { tags: [Diet], summary: "Restore a soft-deleted diet plan", security: [{bearerAuth: []}], responses: { 200: { description: Diet plan restored } } } } } */
dietPlanRouter.post(
  '/:id/restore',
  requirePermission('diets:restore'),
  validate({ params: idParamSchema }),
  asyncHandler(dietPlanController.restore.bind(dietPlanController)),
);

/** @openapi { "/diet-plans/{id}/duplicate": { post: { tags: [Diet], summary: "Duplicate a diet plan, including its meals — always created inactive", security: [{bearerAuth: []}], responses: { 201: { description: Diet plan duplicated } } } } } */
dietPlanRouter.post(
  '/:id/duplicate',
  requirePermission('diets:create'),
  validate({ params: idParamSchema }),
  asyncHandler(dietPlanController.duplicate.bind(dietPlanController)),
);

/** @openapi { "/diet-plans/{id}/assign": { post: { tags: [Diet], summary: "Assign a diet plan to a member — supersedes any currently active plan for that member", security: [{bearerAuth: []}], responses: { 201: { description: Assignment created } } } } } */
dietPlanRouter.post(
  '/:id/assign',
  requirePermission('diets:assign'),
  validate({ params: idParamSchema, body: assignDietPlanSchema }),
  asyncHandler(dietPlanController.assign.bind(dietPlanController)),
);

/** @openapi { "/diet-plans/{id}": { delete: { tags: [Diet], summary: "Soft-delete a diet plan", security: [{bearerAuth: []}], responses: { 200: { description: Diet plan deleted } } } } } */
dietPlanRouter.delete(
  '/:id',
  requirePermission('diets:delete'),
  validate({ params: idParamSchema }),
  asyncHandler(dietPlanController.softDelete.bind(dietPlanController)),
);
