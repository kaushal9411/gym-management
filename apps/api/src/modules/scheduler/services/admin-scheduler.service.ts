import type { JobCategory, JobRunStatus } from '@prisma/client';

import { NotFoundError } from '../../../core/errors/app-error';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { jobExecutionRepository } from '../repositories/job-execution.repository';
import { scheduledJobRepository } from '../repositories/scheduled-job.repository';

import * as engine from './scheduler-engine.service';

async function audit(adminUserId: string, adminRole: string, action: string, entityId: string): Promise<void> {
  await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action, entityType: 'ScheduledJob', entityId });
}

export class AdminSchedulerService {
  // ── Job Management ────────────────────────────────────────────────────
  async listJobs(params: { category?: JobCategory; page: number; limit: number }) {
    const skip = (params.page - 1) * params.limit;
    const { total, items } = await scheduledJobRepository.list({ category: params.category, skip, take: params.limit });
    return { items, total, page: params.page, limit: params.limit, totalPages: Math.max(1, Math.ceil(total / params.limit)) };
  }

  async getJobDetails(name: string) {
    const job = await scheduledJobRepository.findByName(name);
    if (!job) throw new NotFoundError(`Job not found: ${name}`);
    const { items: recentExecutions } = await jobExecutionRepository.history({ jobName: name, skip: 0, take: 10 });
    return { ...job, recentExecutions };
  }

  async triggerJob(name: string, adminUserId: string, adminRole: string) {
    await engine.triggerJob(name, adminUserId);
    await audit(adminUserId, adminRole, 'admin.scheduler_job_triggered', name);
  }

  async pauseJob(name: string, adminUserId: string, adminRole: string) {
    await engine.pauseJob(name);
    await audit(adminUserId, adminRole, 'admin.scheduler_job_paused', name);
  }

  async resumeJob(name: string, adminUserId: string, adminRole: string) {
    await engine.resumeJob(name);
    await audit(adminUserId, adminRole, 'admin.scheduler_job_resumed', name);
  }

  async cancelJob(name: string, adminUserId: string, adminRole: string) {
    await engine.cancelJob(name);
    await audit(adminUserId, adminRole, 'admin.scheduler_job_cancelled', name);
  }

  async retryFailedJob(name: string, adminUserId: string, adminRole: string) {
    await engine.retryFailedJob(name, adminUserId);
    await audit(adminUserId, adminRole, 'admin.scheduler_job_retried', name);
  }

  async getJobHistory(params: { jobName?: string; status?: JobRunStatus; page: number; limit: number }) {
    const skip = (params.page - 1) * params.limit;
    const { total, items } = await jobExecutionRepository.history({ jobName: params.jobName, status: params.status, skip, take: params.limit });
    return { items, total, page: params.page, limit: params.limit, totalPages: Math.max(1, Math.ceil(total / params.limit)) };
  }

  async getFailedJobs(params: { page: number; limit: number }) {
    const skip = (params.page - 1) * params.limit;
    const { total, items } = await jobExecutionRepository.failed({ skip, take: params.limit });
    return { items, total, page: params.page, limit: params.limit, totalPages: Math.max(1, Math.ceil(total / params.limit)) };
  }

  // ── Queue Management ───────────────────────────────────────────────────
  async getQueueStatuses() {
    return engine.getQueueStatuses();
  }

  async retryQueue(queueName: string, adminUserId: string, adminRole: string) {
    const retried = await engine.retryQueue(queueName);
    await audit(adminUserId, adminRole, 'admin.scheduler_queue_retried', queueName);
    return { retried };
  }

  async clearQueue(queueName: string, adminUserId: string, adminRole: string) {
    await engine.clearQueue(queueName);
    await audit(adminUserId, adminRole, 'admin.scheduler_queue_cleared', queueName);
  }

  async pauseQueue(queueName: string, adminUserId: string, adminRole: string) {
    await engine.pauseQueue(queueName);
    await audit(adminUserId, adminRole, 'admin.scheduler_queue_paused', queueName);
  }

  async resumeQueue(queueName: string, adminUserId: string, adminRole: string) {
    await engine.resumeQueue(queueName);
    await audit(adminUserId, adminRole, 'admin.scheduler_queue_resumed', queueName);
  }

  // ── Dashboard ───────────────────────────────────────────────────────────
  async getDashboard() {
    const [jobs, queueStatuses, recentExecutions] = await Promise.all([
      scheduledJobRepository.findAll(),
      engine.getQueueStatuses(),
      jobExecutionRepository.recentAcrossAllJobs(200),
    ]);

    const runningJobs = jobs.filter((j) => j.status === 'RUNNING').length;
    const scheduledJobs = jobs.filter((j) => j.status === 'SCHEDULED').length;
    const failedJobs = jobs.filter((j) => j.status === 'FAILED').length;
    const pausedJobs = jobs.filter((j) => j.status === 'PAUSED' || j.status === 'CANCELLED').length;

    const queueSize = queueStatuses.reduce((sum, q) => sum + (q.counts.waiting ?? 0) + (q.counts.delayed ?? 0), 0);
    const anyQueuePaused = queueStatuses.some((q) => q.isPaused);
    const totalFailedInQueues = queueStatuses.reduce((sum, q) => sum + (q.counts.failed ?? 0), 0);
    const queueHealth = anyQueuePaused ? 'degraded' : totalFailedInQueues > 20 ? 'unhealthy' : 'healthy';

    const completed = recentExecutions.filter((e) => e.status === 'COMPLETED');
    const failed = recentExecutions.filter((e) => e.status === 'FAILED');
    const withDuration = recentExecutions.filter((e) => e.durationMs != null);
    const avgProcessingTimeMs = withDuration.length > 0 ? Math.round(withDuration.reduce((sum, e) => sum + (e.durationMs ?? 0), 0) / withDuration.length) : 0;
    const successRate = completed.length + failed.length > 0 ? Math.round((completed.length / (completed.length + failed.length)) * 1000) / 10 : 100;

    return {
      runningJobs,
      scheduledJobs,
      failedJobs,
      pausedJobs,
      queueSize,
      queueHealth,
      workerStatus: queueStatuses.map((q) => ({ queueName: q.queueName, category: q.category, isPaused: q.isPaused, counts: q.counts })),
      avgProcessingTimeMs,
      successRate,
    };
  }
}

export const adminSchedulerService = new AdminSchedulerService();
