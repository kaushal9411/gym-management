import { Router } from 'express';

import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';

import { hrAdminRouter } from './hr-admin.routes';
import { hrPayrollRouter } from './hr-payroll.routes';
import { hrSelfRouter } from './hr-self.routes';

/**
 * HR Management (Prompt 182) - mounted at `/hr`. `/hr/me/*` (self-service,
 * always the caller's own data) is registered first so it can never be
 * shadowed by a parameterised admin path.
 */
export const hrRouter: Router = Router();

hrRouter.use(authenticateMiddleware);
hrRouter.use(hrSelfRouter);
hrRouter.use(hrPayrollRouter);
hrRouter.use(hrAdminRouter);
