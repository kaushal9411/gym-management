import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { analyticsController } from '../controllers/analytics.controller';
import { trendQuerySchema } from '../validators/reports.validators';

export const analyticsRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

analyticsRouter.use(authenticateMiddleware);

/** @openapi { "/analytics/revenue-trends": { get: { tags: [Analytics], summary: "Daily income vs expenses over a date range", security: [{bearerAuth: []}], responses: { 200: { description: "RevenueTrendPoint[]" } } } } } */
analyticsRouter.get('/revenue-trends', requirePermission('analytics:view'), validate({ query: trendQuerySchema }), asyncHandler(analyticsController.revenueTrends.bind(analyticsController)));

/** @openapi { "/analytics/attendance-trends": { get: { tags: [Analytics], summary: "Daily check-in counts over a date range", security: [{bearerAuth: []}], responses: { 200: { description: "TrendPoint[]" } } } } } */
analyticsRouter.get(
  '/attendance-trends',
  requirePermission('analytics:view'),
  validate({ query: trendQuerySchema }),
  asyncHandler(analyticsController.attendanceTrends.bind(analyticsController)),
);

/** @openapi { "/analytics/membership-growth": { get: { tags: [Analytics], summary: "New memberships per day over a date range", security: [{bearerAuth: []}], responses: { 200: { description: "TrendPoint[]" } } } } } */
analyticsRouter.get(
  '/membership-growth',
  requirePermission('analytics:view'),
  validate({ query: trendQuerySchema }),
  asyncHandler(analyticsController.membershipGrowth.bind(analyticsController)),
);

/** @openapi { "/analytics/new-member-growth": { get: { tags: [Analytics], summary: "New members per day over a date range", security: [{bearerAuth: []}], responses: { 200: { description: "TrendPoint[]" } } } } } */
analyticsRouter.get(
  '/new-member-growth',
  requirePermission('analytics:view'),
  validate({ query: trendQuerySchema }),
  asyncHandler(analyticsController.newMemberGrowth.bind(analyticsController)),
);

/** @openapi { "/analytics/retention": { get: { tags: [Analytics], summary: "Member Retention — daily active-member snapshot over a date range", security: [{bearerAuth: []}], responses: { 200: { description: "TrendPoint[]" } } } } } */
analyticsRouter.get('/retention', requirePermission('analytics:view'), validate({ query: trendQuerySchema }), asyncHandler(analyticsController.retention.bind(analyticsController)));

/** @openapi { "/analytics/payment-collection": { get: { tags: [Analytics], summary: "Collected payments vs invoiced amounts over a date range", security: [{bearerAuth: []}], responses: { 200: { description: "RevenueTrendPoint[]" } } } } } */
analyticsRouter.get(
  '/payment-collection',
  requirePermission('analytics:view'),
  validate({ query: trendQuerySchema }),
  asyncHandler(analyticsController.paymentCollection.bind(analyticsController)),
);

/** @openapi { "/analytics/branch-comparison": { get: { tags: [Analytics], summary: "Point-in-time comparison of members/revenue/attendance across branches", security: [{bearerAuth: []}], responses: { 200: { description: "BranchComparisonRow[]" } } } } } */
analyticsRouter.get(
  '/branch-comparison',
  requirePermission('analytics:view'),
  asyncHandler(analyticsController.branchComparison.bind(analyticsController)),
);
