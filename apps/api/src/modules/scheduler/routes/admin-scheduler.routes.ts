import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminSchedulerController } from '../controllers/admin-scheduler.controller';
import {
  jobHistoryQuerySchema,
  jobNameParamSchema,
  listJobsQuerySchema,
  paginationQuerySchema,
  queueNameParamSchema,
} from '../validators/admin-scheduler.validators';

export const adminSchedulerRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminSchedulerRouter.use(adminAuthenticateMiddleware);

/** @openapi { "/admin/scheduler/dashboard": { get: { tags: [Admin Scheduler], summary: Scheduler dashboard (running/scheduled/failed jobs, queue health, throughput), security: [{bearerAuth: []}], responses: { 200: { description: Dashboard summary } } } } } */
adminSchedulerRouter.get('/dashboard', requireAdminPermission('scheduler:view'), asyncHandler(adminSchedulerController.getDashboard.bind(adminSchedulerController)));

/** @openapi { "/admin/scheduler/jobs": { get: { tags: [Admin Scheduler], summary: Job List, security: [{bearerAuth: []}], responses: { 200: { description: Paginated jobs } } } } } */
adminSchedulerRouter.get(
  '/jobs',
  requireAdminPermission('scheduler:view'),
  validate({ query: listJobsQuerySchema }),
  asyncHandler(adminSchedulerController.listJobs.bind(adminSchedulerController)),
);

/** @openapi { "/admin/scheduler/jobs/history": { get: { tags: [Admin Scheduler], summary: Get Job History, security: [{bearerAuth: []}], responses: { 200: { description: Paginated execution history } } } } } */
adminSchedulerRouter.get(
  '/jobs/history',
  requireAdminPermission('scheduler:view'),
  validate({ query: jobHistoryQuerySchema }),
  asyncHandler(adminSchedulerController.getJobHistory.bind(adminSchedulerController)),
);

/** @openapi { "/admin/scheduler/jobs/failed": { get: { tags: [Admin Scheduler], summary: Get Failed Jobs, security: [{bearerAuth: []}], responses: { 200: { description: Paginated failed executions } } } } } */
adminSchedulerRouter.get(
  '/jobs/failed',
  requireAdminPermission('scheduler:view'),
  validate({ query: paginationQuerySchema }),
  asyncHandler(adminSchedulerController.getFailedJobs.bind(adminSchedulerController)),
);

/** @openapi { "/admin/scheduler/jobs/{name}": { get: { tags: [Admin Scheduler], summary: Get Job Details, security: [{bearerAuth: []}], responses: { 200: { description: Job detail + recent executions } } } } } */
adminSchedulerRouter.get(
  '/jobs/:name',
  requireAdminPermission('scheduler:view'),
  validate({ params: jobNameParamSchema }),
  asyncHandler(adminSchedulerController.getJobDetails.bind(adminSchedulerController)),
);

/** @openapi { "/admin/scheduler/jobs/{name}/trigger": { post: { tags: [Admin Scheduler], summary: Trigger Job Manually, security: [{bearerAuth: []}], responses: { 200: { description: Triggered } } } } } */
adminSchedulerRouter.post(
  '/jobs/:name/trigger',
  requireAdminPermission('scheduler:trigger'),
  validate({ params: jobNameParamSchema }),
  asyncHandler(adminSchedulerController.triggerJob.bind(adminSchedulerController)),
);

/** @openapi { "/admin/scheduler/jobs/{name}/retry": { post: { tags: [Admin Scheduler], summary: Retry Failed Job, security: [{bearerAuth: []}], responses: { 200: { description: Retry enqueued } } } } } */
adminSchedulerRouter.post(
  '/jobs/:name/retry',
  requireAdminPermission('scheduler:retry'),
  validate({ params: jobNameParamSchema }),
  asyncHandler(adminSchedulerController.retryFailedJob.bind(adminSchedulerController)),
);

/** @openapi { "/admin/scheduler/jobs/{name}/pause": { post: { tags: [Admin Scheduler], summary: Pause Job, security: [{bearerAuth: []}], responses: { 200: { description: Paused } } } } } */
adminSchedulerRouter.post(
  '/jobs/:name/pause',
  requireAdminPermission('scheduler:pause'),
  validate({ params: jobNameParamSchema }),
  asyncHandler(adminSchedulerController.pauseJob.bind(adminSchedulerController)),
);

/** @openapi { "/admin/scheduler/jobs/{name}/resume": { post: { tags: [Admin Scheduler], summary: Resume Job, security: [{bearerAuth: []}], responses: { 200: { description: Resumed } } } } } */
adminSchedulerRouter.post(
  '/jobs/:name/resume',
  requireAdminPermission('scheduler:manage'),
  validate({ params: jobNameParamSchema }),
  asyncHandler(adminSchedulerController.resumeJob.bind(adminSchedulerController)),
);

/** @openapi { "/admin/scheduler/jobs/{name}/cancel": { post: { tags: [Admin Scheduler], summary: Cancel Job, security: [{bearerAuth: []}], responses: { 200: { description: Cancelled } } } } } */
adminSchedulerRouter.post(
  '/jobs/:name/cancel',
  requireAdminPermission('scheduler:manage'),
  validate({ params: jobNameParamSchema }),
  asyncHandler(adminSchedulerController.cancelJob.bind(adminSchedulerController)),
);

/** @openapi { "/admin/scheduler/queues": { get: { tags: [Admin Scheduler], summary: Get Queue Status, security: [{bearerAuth: []}], responses: { 200: { description: Per-queue counts + health } } } } } */
adminSchedulerRouter.get('/queues', requireAdminPermission('scheduler:view'), asyncHandler(adminSchedulerController.getQueueStatuses.bind(adminSchedulerController)));

/** @openapi { "/admin/scheduler/queues/{queueName}/retry": { post: { tags: [Admin Scheduler], summary: Retry Queue (all failed jobs in it), security: [{bearerAuth: []}], responses: { 200: { description: Re-enqueued } } } } } */
adminSchedulerRouter.post(
  '/queues/:queueName/retry',
  requireAdminPermission('scheduler:retry'),
  validate({ params: queueNameParamSchema }),
  asyncHandler(adminSchedulerController.retryQueue.bind(adminSchedulerController)),
);

/** @openapi { "/admin/scheduler/queues/{queueName}/clear": { post: { tags: [Admin Scheduler], summary: Clear Queue (waiting/delayed backlog only), security: [{bearerAuth: []}], responses: { 200: { description: Cleared } } } } } */
adminSchedulerRouter.post(
  '/queues/:queueName/clear',
  requireAdminPermission('scheduler:manage'),
  validate({ params: queueNameParamSchema }),
  asyncHandler(adminSchedulerController.clearQueue.bind(adminSchedulerController)),
);

/** @openapi { "/admin/scheduler/queues/{queueName}/pause": { post: { tags: [Admin Scheduler], summary: Pause Queue, security: [{bearerAuth: []}], responses: { 200: { description: Paused } } } } } */
adminSchedulerRouter.post(
  '/queues/:queueName/pause',
  requireAdminPermission('scheduler:pause'),
  validate({ params: queueNameParamSchema }),
  asyncHandler(adminSchedulerController.pauseQueue.bind(adminSchedulerController)),
);

/** @openapi { "/admin/scheduler/queues/{queueName}/resume": { post: { tags: [Admin Scheduler], summary: Resume Queue, security: [{bearerAuth: []}], responses: { 200: { description: Resumed } } } } } */
adminSchedulerRouter.post(
  '/queues/:queueName/resume',
  requireAdminPermission('scheduler:manage'),
  validate({ params: queueNameParamSchema }),
  asyncHandler(adminSchedulerController.resumeQueue.bind(adminSchedulerController)),
);
