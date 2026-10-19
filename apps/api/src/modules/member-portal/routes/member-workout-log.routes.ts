import { Router } from 'express';

import { createRateLimiter } from '../../../core/middleware/rate-limiter';
import { validate } from '../../../core/middleware/validate.middleware';
import { memberWorkoutLogController as controller } from '../controllers/member-workout-log.controller';
import { memberPortalIdParamSchema } from '../validators/member-portal.validators';
import {
  memberWorkoutCompleteSchema,
  memberWorkoutDayParamSchema,
  memberWorkoutHistoryQuerySchema,
  memberWorkoutLogSchema,
  memberWorkoutLogUpdateSchema,
} from '../validators/member-workout-log.validators';

/**
 * Mounted by `memberPortalRouter` at `/workout/log`, i.e. UNDER its router-level
 * `memberAuthenticateMiddleware` - every route here already has a valid member token.
 */
export const memberWorkoutLogRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

// Per-member throttle (keyed on the token's member id, never the body): a full day is ~10 taps.
const workoutLogWriteLimiter = () =>
  createRateLimiter({
    windowMs: 15 * 60_000,
    max: 120,
    prefix: 'member-workout-log-write',
    keyGenerator: (req) => `${req.tenant?.id ?? 'platform'}:${req.memberAuth?.sub ?? req.ip}`,
  });

/**
 * @openapi
 * /portal/workout/log:
 *   get:
 *     tags: [Member Portal]
 *     summary: Own workout log history (entries + per-day session metadata), newest first
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: days, schema: { type: integer, minimum: 1, maximum: 120, default: 60 } }
 *     responses:
 *       200: { description: "{ today, from, entries[], sessions[] }" }
 *   post:
 *     tags: [Member Portal]
 *     summary: Log one exercise of the active plan for a day (default today, branch-local). Logging the same exercise/day again updates it (200 vs 201). The exercise must be scheduled on that weekday; no future dates; back-dating up to 14 days. Also mirrors the latest status into the legacy per-exercise progress.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, additionalProperties: false, required: [exerciseId, status], properties: { exerciseId: { type: string, format: uuid }, date: { type: string, example: "2026-10-19" }, status: { type: string, enum: [COMPLETED, SKIPPED] }, setsDone: { type: integer, nullable: true }, repsDone: { type: integer, nullable: true }, weightKg: { type: number, nullable: true }, durationMin: { type: integer, nullable: true }, notes: { type: string, nullable: true } } }
 *     responses:
 *       200: { description: Existing entry updated }
 *       201: { description: Entry created }
 *       404: { description: No active workout plan }
 *       422: { description: Bad value, exercise not scheduled that day, future / too-old date }
 * /portal/workout/log/{id}:
 *   patch:
 *     tags: [Member Portal]
 *     summary: Edit an own entry (status / sets / reps / weight / duration / notes). Another member's id is 404.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated entry and refreshed workout }
 *       404: { description: Not found or not owned }
 *   delete:
 *     tags: [Member Portal]
 *     summary: Undo an own entry. Another member's id is 404.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Removed }
 *       404: { description: Not found or not owned }
 * /portal/workout/log/complete:
 *   post:
 *     tags: [Member Portal]
 *     summary: Complete the day's workout - every unlogged scheduled exercise becomes COMPLETED, with optional duration (1-600 min), effort (1-5) and note
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema: { type: object, additionalProperties: false, properties: { date: { type: string }, durationMin: { type: integer, nullable: true }, effort: { type: integer, minimum: 1, maximum: 5, nullable: true }, notes: { type: string, nullable: true } } }
 *     responses:
 *       200: { description: "{ completedNow, workout }" }
 *       422: { description: Nothing scheduled that day, or everything is skipped }
 * /portal/workout/log/day/{date}:
 *   delete:
 *     tags: [Member Portal]
 *     summary: Clear everything logged for a day (entries + session metadata)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: date, required: true, schema: { type: string, example: "2026-10-19" } }
 *     responses:
 *       200: { description: Cleared }
 */
// Static paths first so `complete` / `day/:date` are never read as an `:id`.
memberWorkoutLogRouter.get(
  '/',
  validate({ query: memberWorkoutHistoryQuerySchema }),
  asyncHandler(controller.history.bind(controller)),
);
memberWorkoutLogRouter.post(
  '/',
  workoutLogWriteLimiter(),
  validate({ body: memberWorkoutLogSchema }),
  asyncHandler(controller.log.bind(controller)),
);
memberWorkoutLogRouter.post(
  '/complete',
  workoutLogWriteLimiter(),
  validate({ body: memberWorkoutCompleteSchema }),
  asyncHandler(controller.complete.bind(controller)),
);
memberWorkoutLogRouter.delete(
  '/day/:date',
  workoutLogWriteLimiter(),
  validate({ params: memberWorkoutDayParamSchema }),
  asyncHandler(controller.resetDay.bind(controller)),
);
memberWorkoutLogRouter.patch(
  '/:id',
  workoutLogWriteLimiter(),
  validate({ params: memberPortalIdParamSchema, body: memberWorkoutLogUpdateSchema }),
  asyncHandler(controller.update.bind(controller)),
);
memberWorkoutLogRouter.delete(
  '/:id',
  workoutLogWriteLimiter(),
  validate({ params: memberPortalIdParamSchema }),
  asyncHandler(controller.remove.bind(controller)),
);
