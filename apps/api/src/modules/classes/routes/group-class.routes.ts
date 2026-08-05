import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { groupClassController } from '../controllers/group-class.controller';
import { createGroupClassSchema, idParamSchema, listGroupClassesQuerySchema, setScheduleSchema, updateGroupClassSchema } from '../validators/classes.validators';

export const groupClassRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

groupClassRouter.use(authenticateMiddleware);

groupClassRouter.get('/assignable', requirePermission('classes:view'), asyncHandler(groupClassController.listActive.bind(groupClassController)));
groupClassRouter.get('/', requirePermission('classes:view'), validate({ query: listGroupClassesQuerySchema }), asyncHandler(groupClassController.list.bind(groupClassController)));
groupClassRouter.get('/:id', requirePermission('classes:view'), validate({ params: idParamSchema }), asyncHandler(groupClassController.getById.bind(groupClassController)));
groupClassRouter.post('/', requirePermission('classes:create'), validate({ body: createGroupClassSchema }), asyncHandler(groupClassController.create.bind(groupClassController)));
groupClassRouter.patch(
  '/:id',
  requirePermission('classes:update'),
  validate({ params: idParamSchema, body: updateGroupClassSchema }),
  asyncHandler(groupClassController.update.bind(groupClassController)),
);
groupClassRouter.patch(
  '/:id/schedule',
  requirePermission('classes:update'),
  validate({ params: idParamSchema, body: setScheduleSchema }),
  asyncHandler(groupClassController.setSchedule.bind(groupClassController)),
);
groupClassRouter.delete('/:id', requirePermission('classes:delete'), validate({ params: idParamSchema }), asyncHandler(groupClassController.softDelete.bind(groupClassController)));
groupClassRouter.post('/:id/restore', requirePermission('classes:restore'), validate({ params: idParamSchema }), asyncHandler(groupClassController.restore.bind(groupClassController)));
