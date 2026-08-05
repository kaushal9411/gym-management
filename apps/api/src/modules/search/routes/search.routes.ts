import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { searchController } from '../controllers/search.controller';
import { globalSearchQuerySchema } from '../validators/search.validators';

export const searchRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

searchRouter.use(authenticateMiddleware);

/**
 * @openapi
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Cross-module lookup across Members/Staff/Branches, permission-filtered per category
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ members, staff, branches }, each up to 5 items" }
 */
searchRouter.get('/', validate({ query: globalSearchQuerySchema }), asyncHandler(searchController.search.bind(searchController)));
