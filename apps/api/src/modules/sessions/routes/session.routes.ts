import { Router } from 'express';
import { z } from 'zod';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { sessionController } from '../controllers/session.controller';

export const sessionRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

const loginHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * @openapi
 * /sessions/login-history:
 *   get:
 *     tags: [Sessions]
 *     summary: The current user's own login history (successes and failures)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated login attempts }
 */
sessionRouter.get(
  '/login-history',
  authenticateMiddleware,
  validate({ query: loginHistoryQuerySchema }),
  asyncHandler(sessionController.loginHistory.bind(sessionController)),
);
