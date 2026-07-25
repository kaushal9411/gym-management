import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { workoutPlanController } from '../controllers/workout-plan.controller';
import {
  assignmentIdParamSchema,
  assignWorkoutPlanSchema,
  createWorkoutPlanSchema,
  idParamSchema,
  listWorkoutPlansQuerySchema,
  markProgressSchema,
  memberIdParamSchema,
  setPlanExercisesSchema,
  updateMemberWorkoutPlanSchema,
  updateWorkoutPlanSchema,
} from '../validators/workout.validators';

export const workoutPlanRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

workoutPlanRouter.use(authenticateMiddleware);

/** @openapi { "/workout-plans/assignable": { get: { tags: [Workouts], summary: "Unfiltered active-only plan list — backs the Assign Workout Plan dropdown", security: [{bearerAuth: []}], responses: { 200: { description: "WorkoutPlan[]" } } } } } */
workoutPlanRouter.get('/assignable', requirePermission('workouts:view'), asyncHandler(workoutPlanController.listAssignable.bind(workoutPlanController)));

/** @openapi { "/workout-plans/members/{memberId}": { get: { tags: [Workouts], summary: "A member's current + historical workout plan assignments", security: [{bearerAuth: []}], responses: { 200: { description: "{ current, history }" } } } } } */
workoutPlanRouter.get(
  '/members/:memberId',
  requirePermission('workouts:view'),
  validate({ params: memberIdParamSchema }),
  asyncHandler(workoutPlanController.getMemberWorkoutPlans.bind(workoutPlanController)),
);

/** @openapi { "/workout-plans/assignments/{assignmentId}/remove": { post: { tags: [Workouts], summary: "Remove (cancel) an active workout plan assignment — preserves it as history", security: [{bearerAuth: []}], responses: { 200: { description: Removed } } } } } */
workoutPlanRouter.post(
  '/assignments/:assignmentId/remove',
  requirePermission('workouts:assign'),
  validate({ params: assignmentIdParamSchema }),
  asyncHandler(workoutPlanController.remove.bind(workoutPlanController)),
);

/** @openapi { "/workout-plans/assignments/{assignmentId}/progress": { post: { tags: [Workouts], summary: "Mark one exercise complete/skipped/pending for a member's assignment", security: [{bearerAuth: []}], responses: { 200: { description: Assignment with updated progress } } } } } */
workoutPlanRouter.post(
  '/assignments/:assignmentId/progress',
  requirePermission('workouts:progress'),
  validate({ params: assignmentIdParamSchema, body: markProgressSchema }),
  asyncHandler(workoutPlanController.markProgress.bind(workoutPlanController)),
);

/** @openapi { "/workout-plans/assignments/{assignmentId}": { patch: { tags: [Workouts], summary: "Update an assignment's dates/trainer remarks/member notes", security: [{bearerAuth: []}], responses: { 200: { description: Assignment updated } } } } } */
workoutPlanRouter.patch(
  '/assignments/:assignmentId',
  requirePermission('workouts:update'),
  validate({ params: assignmentIdParamSchema, body: updateMemberWorkoutPlanSchema }),
  asyncHandler(workoutPlanController.updateAssignment.bind(workoutPlanController)),
);

/**
 * @openapi
 * /workout-plans:
 *   get:
 *     tags: [Workouts]
 *     summary: Paginated workout plan list with search + filters (level, trainer, status)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ items, total, page, limit, totalPages }" }
 */
workoutPlanRouter.get(
  '/',
  requirePermission('workouts:view'),
  validate({ query: listWorkoutPlansQuerySchema }),
  asyncHandler(workoutPlanController.list.bind(workoutPlanController)),
);

/** @openapi { "/workout-plans": { post: { tags: [Workouts], summary: "Create a workout plan — trainerId, if given, must be an active Trainer", security: [{bearerAuth: []}], responses: { 201: { description: Workout plan created } } } } } */
workoutPlanRouter.post(
  '/',
  requirePermission('workouts:create'),
  validate({ body: createWorkoutPlanSchema }),
  asyncHandler(workoutPlanController.create.bind(workoutPlanController)),
);

/** @openapi { "/workout-plans/{id}": { get: { tags: [Workouts], summary: "One workout plan's details, including its weekly exercise schedule", security: [{bearerAuth: []}], responses: { 200: { description: Workout plan } } } } } */
workoutPlanRouter.get(
  '/:id',
  requirePermission('workouts:view'),
  validate({ params: idParamSchema }),
  asyncHandler(workoutPlanController.getById.bind(workoutPlanController)),
);

/** @openapi { "/workout-plans/{id}": { patch: { tags: [Workouts], summary: "Update a workout plan", security: [{bearerAuth: []}], responses: { 200: { description: Workout plan updated } } } } } */
workoutPlanRouter.patch(
  '/:id',
  requirePermission('workouts:update'),
  validate({ params: idParamSchema, body: updateWorkoutPlanSchema }),
  asyncHandler(workoutPlanController.update.bind(workoutPlanController)),
);

/** @openapi { "/workout-plans/{id}/exercises": { patch: { tags: [Workouts], summary: "Replace a plan's whole weekly exercise schedule (array order = drag-and-drop sort order per day)", security: [{bearerAuth: []}], responses: { 200: { description: Workout plan updated } } } } } */
workoutPlanRouter.patch(
  '/:id/exercises',
  requirePermission('workouts:update'),
  validate({ params: idParamSchema, body: setPlanExercisesSchema }),
  asyncHandler(workoutPlanController.setExercises.bind(workoutPlanController)),
);

/** @openapi { "/workout-plans/{id}/activate": { post: { tags: [Workouts], summary: "Activate a workout plan", security: [{bearerAuth: []}], responses: { 200: { description: Activated } } } } } */
workoutPlanRouter.post(
  '/:id/activate',
  requirePermission('workouts:update'),
  validate({ params: idParamSchema }),
  asyncHandler(workoutPlanController.activate.bind(workoutPlanController)),
);

/** @openapi { "/workout-plans/{id}/deactivate": { post: { tags: [Workouts], summary: "Deactivate a workout plan", security: [{bearerAuth: []}], responses: { 200: { description: Deactivated } } } } } */
workoutPlanRouter.post(
  '/:id/deactivate',
  requirePermission('workouts:update'),
  validate({ params: idParamSchema }),
  asyncHandler(workoutPlanController.deactivate.bind(workoutPlanController)),
);

/** @openapi { "/workout-plans/{id}/restore": { post: { tags: [Workouts], summary: "Restore a soft-deleted workout plan", security: [{bearerAuth: []}], responses: { 200: { description: Workout plan restored } } } } } */
workoutPlanRouter.post(
  '/:id/restore',
  requirePermission('workouts:restore'),
  validate({ params: idParamSchema }),
  asyncHandler(workoutPlanController.restore.bind(workoutPlanController)),
);

/** @openapi { "/workout-plans/{id}/duplicate": { post: { tags: [Workouts], summary: "Duplicate a workout plan, including its exercises — always created inactive", security: [{bearerAuth: []}], responses: { 201: { description: Workout plan duplicated } } } } } */
workoutPlanRouter.post(
  '/:id/duplicate',
  requirePermission('workouts:create'),
  validate({ params: idParamSchema }),
  asyncHandler(workoutPlanController.duplicate.bind(workoutPlanController)),
);

/** @openapi { "/workout-plans/{id}/assign": { post: { tags: [Workouts], summary: "Assign a workout plan to a member — supersedes any currently active plan for that member", security: [{bearerAuth: []}], responses: { 201: { description: Assignment created } } } } } */
workoutPlanRouter.post(
  '/:id/assign',
  requirePermission('workouts:assign'),
  validate({ params: idParamSchema, body: assignWorkoutPlanSchema }),
  asyncHandler(workoutPlanController.assign.bind(workoutPlanController)),
);

/** @openapi { "/workout-plans/{id}": { delete: { tags: [Workouts], summary: "Soft-delete a workout plan", security: [{bearerAuth: []}], responses: { 200: { description: Workout plan deleted } } } } } */
workoutPlanRouter.delete(
  '/:id',
  requirePermission('workouts:delete'),
  validate({ params: idParamSchema }),
  asyncHandler(workoutPlanController.softDelete.bind(workoutPlanController)),
);
