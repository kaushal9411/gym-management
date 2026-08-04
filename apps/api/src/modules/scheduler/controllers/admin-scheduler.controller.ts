import type { JobCategory, JobRunStatus } from '@prisma/client';
import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminSchedulerService } from '../services/admin-scheduler.service';

export class AdminSchedulerController {
  // ── Job Management ────────────────────────────────────────────────────
  async listJobs(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminSchedulerService.listJobs(req.query as unknown as { category?: JobCategory; page: number; limit: number }));
  }

  async getJobDetails(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminSchedulerService.getJobDetails(req.params.name!));
  }

  async triggerJob(req: Request, res: Response): Promise<void> {
    await adminSchedulerService.triggerJob(req.params.name!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Job triggered.');
  }

  async pauseJob(req: Request, res: Response): Promise<void> {
    await adminSchedulerService.pauseJob(req.params.name!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Job paused.');
  }

  async resumeJob(req: Request, res: Response): Promise<void> {
    await adminSchedulerService.resumeJob(req.params.name!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Job resumed.');
  }

  async cancelJob(req: Request, res: Response): Promise<void> {
    await adminSchedulerService.cancelJob(req.params.name!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Job cancelled.');
  }

  async retryFailedJob(req: Request, res: Response): Promise<void> {
    await adminSchedulerService.retryFailedJob(req.params.name!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Job retry enqueued.');
  }

  async getJobHistory(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminSchedulerService.getJobHistory(req.query as unknown as { jobName?: string; status?: JobRunStatus; page: number; limit: number }));
  }

  async getFailedJobs(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminSchedulerService.getFailedJobs(req.query as unknown as { page: number; limit: number }));
  }

  // ── Queue Management ───────────────────────────────────────────────────
  async getQueueStatuses(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminSchedulerService.getQueueStatuses());
  }

  async retryQueue(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminSchedulerService.retryQueue(req.params.queueName!, req.admin!.sub, req.admin!.role), 'Failed jobs re-enqueued.');
  }

  async clearQueue(req: Request, res: Response): Promise<void> {
    await adminSchedulerService.clearQueue(req.params.queueName!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Queue backlog cleared.');
  }

  async pauseQueue(req: Request, res: Response): Promise<void> {
    await adminSchedulerService.pauseQueue(req.params.queueName!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Queue paused.');
  }

  async resumeQueue(req: Request, res: Response): Promise<void> {
    await adminSchedulerService.resumeQueue(req.params.queueName!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Queue resumed.');
  }

  // ── Dashboard ───────────────────────────────────────────────────────────
  async getDashboard(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminSchedulerService.getDashboard());
  }
}

export const adminSchedulerController = new AdminSchedulerController();
