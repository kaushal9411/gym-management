import { Router } from 'express';

import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { dashboardController } from '../controllers/dashboard.controller';

export const dashboardRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

dashboardRouter.use(authenticateMiddleware);

/** @openapi { "/reports/dashboard/summary": { get: { tags: [Reports], summary: "Full dashboard: all KPIs + recent activity feed", security: [{bearerAuth: []}], responses: { 200: { description: Dashboard summary } } } } } */
dashboardRouter.get('/summary', requirePermission('reports:view'), asyncHandler(dashboardController.getSummary.bind(dashboardController)));

/** @openapi { "/reports/dashboard/kpis": { get: { tags: [Reports], summary: "Just the flat KPI numbers — for a lightweight KPI-cards-only widget", security: [{bearerAuth: []}], responses: { 200: { description: KPI metrics } } } } } */
dashboardRouter.get('/kpis', requirePermission('reports:view'), asyncHandler(dashboardController.getKpis.bind(dashboardController)));

/** @openapi { "/reports/dashboard/recent-activities": { get: { tags: [Reports], summary: "Merged recent-activity feed (payments, check-ins, new members)", security: [{bearerAuth: []}], responses: { 200: { description: "RecentActivity[]" } } } } } */
dashboardRouter.get('/recent-activities', requirePermission('reports:view'), asyncHandler(dashboardController.getRecentActivities.bind(dashboardController)));
