import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { exerciseController } from '../controllers/exercise.controller';
import { createExerciseSchema, idParamSchema, listExercisesQuerySchema, updateExerciseSchema } from '../validators/workout.validators';

export const exerciseRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

exerciseRouter.use(authenticateMiddleware);

/** @openapi { "/exercises/active": { get: { tags: [Workouts], summary: "Unfiltered active-only exercise list — backs the exercise picker", security: [{bearerAuth: []}], responses: { 200: { description: "Exercise[]" } } } } } */
exerciseRouter.get('/active', requirePermission('workouts:view'), asyncHandler(exerciseController.listActive.bind(exerciseController)));

/**
 * @openapi
 * /exercises:
 *   get:
 *     tags: [Workouts]
 *     summary: Paginated exercise library with search + filters (category, muscle group, difficulty, status)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ items, total, page, limit, totalPages }" }
 */
exerciseRouter.get('/', requirePermission('workouts:view'), validate({ query: listExercisesQuerySchema }), asyncHandler(exerciseController.list.bind(exerciseController)));

/** @openapi { "/exercises": { post: { tags: [Workouts], summary: "Add an exercise to the library", security: [{bearerAuth: []}], responses: { 201: { description: Exercise created } } } } } */
exerciseRouter.post('/', requirePermission('workouts:create'), validate({ body: createExerciseSchema }), asyncHandler(exerciseController.create.bind(exerciseController)));

/** @openapi { "/exercises/{id}": { get: { tags: [Workouts], summary: "One exercise's details", security: [{bearerAuth: []}], responses: { 200: { description: Exercise } } } } } */
exerciseRouter.get('/:id', requirePermission('workouts:view'), validate({ params: idParamSchema }), asyncHandler(exerciseController.getById.bind(exerciseController)));

/** @openapi { "/exercises/{id}": { patch: { tags: [Workouts], summary: "Update an exercise", security: [{bearerAuth: []}], responses: { 200: { description: Exercise updated } } } } } */
exerciseRouter.patch(
  '/:id',
  requirePermission('workouts:update'),
  validate({ params: idParamSchema, body: updateExerciseSchema }),
  asyncHandler(exerciseController.update.bind(exerciseController)),
);

/** @openapi { "/exercises/{id}/restore": { post: { tags: [Workouts], summary: "Restore a soft-deleted exercise", security: [{bearerAuth: []}], responses: { 200: { description: Exercise restored } } } } } */
exerciseRouter.post(
  '/:id/restore',
  requirePermission('workouts:restore'),
  validate({ params: idParamSchema }),
  asyncHandler(exerciseController.restore.bind(exerciseController)),
);

/** @openapi { "/exercises/{id}": { delete: { tags: [Workouts], summary: "Soft-delete an exercise", security: [{bearerAuth: []}], responses: { 200: { description: Exercise deleted } } } } } */
exerciseRouter.delete(
  '/:id',
  requirePermission('workouts:delete'),
  validate({ params: idParamSchema }),
  asyncHandler(exerciseController.softDelete.bind(exerciseController)),
);
