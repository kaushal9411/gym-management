import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { requireModuleEnabled } from '../../tenants/middleware/require-module-enabled.middleware';
import { classSessionController } from '../controllers/class-session.controller';
import { generateSessionsSchema, idParamSchema, listSessionsQuerySchema } from '../validators/classes.validators';

export const classSessionRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

classSessionRouter.use(authenticateMiddleware);
classSessionRouter.use(requireModuleEnabled('live_classes'));

classSessionRouter.get('/', requirePermission('classes:view'), validate({ query: listSessionsQuerySchema }), asyncHandler(classSessionController.list.bind(classSessionController)));
classSessionRouter.get('/:id', requirePermission('classes:view'), validate({ params: idParamSchema }), asyncHandler(classSessionController.getById.bind(classSessionController)));
// A maintenance action (regenerate the rolling window on demand, e.g. right after creating/editing a class) — same tier as editing a class.
classSessionRouter.post('/generate', requirePermission('classes:update'), validate({ body: generateSessionsSchema }), asyncHandler(classSessionController.generate.bind(classSessionController)));
