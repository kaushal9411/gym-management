import type { Prisma } from '@prisma/client';
import { Queue, Worker, type Job } from 'bullmq';

import { NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { logger } from '../../../core/logging/logger';
import { redis } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import { createQueueConnection } from '../../../infrastructure/queue/connection';
import { JOB_REGISTRY, queueNameForCategory } from '../constants/job-registry';
import type { JobDefinition, JobTriggerType } from '../types';

interface QueueEntry {
  queue: Queue;
  worker: Worker;
  category: JobDefinition['category'];
}

/** One Queue+Worker per category (6 total) — matches the spec's "Multiple Queues" feature; every job in a category shares its queue/worker/concurrency. */
const queues = new Map<string, QueueEntry>();
const registryByName = new Map<string, JobDefinition>(JOB_REGISTRY.map((def) => [def.name, def]));

const WORKER_CONCURRENCY = 2;

function lockKey(jobName: string): string {
  return `scheduler-lock:${jobName}`;
}

/** Redis SET NX lock — belt-and-suspenders duplicate-execution prevention on top of BullMQ's own single-worker-per-queue processing (matters if this process ever scales to multiple instances). */
async function acquireLock(jobName: string, ttlSeconds: number): Promise<boolean> {
  const result = await redis.set(lockKey(jobName), '1', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

async function releaseLock(jobName: string): Promise<void> {
  await redis.del(lockKey(jobName));
}

async function runWithTimeout(def: JobDefinition, ctx: { trigger: JobTriggerType; triggeredBy?: string }): Promise<Record<string, unknown> | void> {
  return Promise.race([
    def.handler(ctx),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Job timed out after ${def.timeoutMs}ms`)), def.timeoutMs);
    }),
  ]);
}

/**
 * Every job execution — scheduled, manual, or retry — goes through this one
 * path. Persists a `JobExecution` row per attempt (so retries each leave
 * their own history entry), races the handler against `timeoutMs`, and
 * rethrows on failure so BullMQ's own `attempts`/`backoff` still drives the
 * retry. `isFinalAttempt` decides whether the job DEFINITION's own status
 * reflects "still retrying" (stays SCHEDULED) or "exhausted" (FAILED).
 */
async function executeJob(def: JobDefinition, trigger: JobTriggerType, attempt: number, isFinalAttempt: boolean, triggeredBy?: string): Promise<void> {
  const jobRow = await prisma.scheduledJob.findUnique({ where: { name: def.name } });
  if (!jobRow) {
    logger.error('Scheduler job fired for a name with no ScheduledJob row — registry/DB drift', { job: def.name });
    return;
  }

  const lockTtlSeconds = Math.ceil(def.timeoutMs / 1000) + 30;
  const locked = await acquireLock(def.name, lockTtlSeconds);
  if (!locked) {
    logger.warn('Scheduler job skipped — an execution is already in flight (duplicate execution prevented)', { job: def.name });
    return;
  }

  const startedAt = new Date();
  const execution = await prisma.jobExecution.create({
    data: { jobId: jobRow.id, jobName: def.name, status: 'RUNNING', trigger, attempt, triggeredBy, startedAt },
  });
  await prisma.scheduledJob.update({ where: { id: jobRow.id }, data: { status: 'RUNNING', lastRunAt: startedAt } });

  try {
    const result = await runWithTimeout(def, { trigger, triggeredBy });
    const finishedAt = new Date();
    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: { status: 'COMPLETED', finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), result: (result ?? {}) as Prisma.InputJsonValue },
    });
    await prisma.scheduledJob.update({ where: { id: jobRow.id }, data: { status: 'SCHEDULED', lastStatus: 'COMPLETED' } });
  } catch (error) {
    const finishedAt = new Date();
    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: { status: 'FAILED', finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), error: (error as Error).message },
    });
    await prisma.scheduledJob.update({
      where: { id: jobRow.id },
      data: { status: isFinalAttempt ? 'FAILED' : 'SCHEDULED', lastStatus: 'FAILED' },
    });
    throw error;
  } finally {
    await releaseLock(def.name);
    await refreshNextRunAt(def, jobRow.queueName);
  }
}

/** BullMQ advances a repeatable job's own `next` occurrence internally on every run — mirror that onto `ScheduledJob.nextRunAt` so the admin UI's "Next Run" reflects reality instead of only being set once at registration time. */
async function refreshNextRunAt(def: JobDefinition, queueName: string): Promise<void> {
  const entry = queues.get(queueName);
  if (!entry) return;
  const repeatables = await entry.queue.getRepeatableJobs();
  const match = repeatables.find((r) => r.name === def.name);
  await prisma.scheduledJob.update({ where: { name: def.name }, data: { nextRunAt: match?.next ? new Date(match.next) : null } });
}

async function processor(bullJob: Job): Promise<void> {
  const def = registryByName.get(bullJob.name);
  if (!def) {
    logger.error('Unknown job name reached a scheduler worker — registry drift', { name: bullJob.name });
    return;
  }
  const trigger = (bullJob.data?.trigger as JobTriggerType | undefined) ?? 'SCHEDULED';
  const triggeredBy = bullJob.data?.triggeredBy as string | undefined;
  const attempt = bullJob.attemptsMade + 1;
  const maxAttempts = bullJob.opts.attempts ?? 1;
  await executeJob(def, trigger, attempt, attempt >= maxAttempts, triggeredBy);
}

function jobOptions(def: JobDefinition) {
  return {
    attempts: def.maxRetries + 1,
    backoff: { type: 'exponential' as const, delay: def.retryDelayMs },
    priority: def.priority,
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  };
}

async function registerRepeatable(def: JobDefinition, queueName: string): Promise<void> {
  const entry = queues.get(queueName);
  if (!entry) return;
  await entry.queue.add(def.name, { trigger: 'SCHEDULED' satisfies JobTriggerType }, {
    ...jobOptions(def),
    repeat: { pattern: def.cronPattern, tz: def.timezone },
  });
  await refreshNextRunAt(def, queueName);
}

async function removeRepeatable(def: JobDefinition, queueName: string): Promise<void> {
  const entry = queues.get(queueName);
  if (!entry) return;
  const repeatables = await entry.queue.getRepeatableJobs();
  const match = repeatables.find((r) => r.name === def.name);
  if (match) await entry.queue.removeRepeatableByKey(match.key);
}

/** Boots one Queue+Worker per category, upserts every registry entry into `ScheduledJob`, and (re)registers the cron schedule for every job that isn't paused/cancelled. Idempotent — safe to call once per process start. */
export async function initScheduler(): Promise<void> {
  for (const def of JOB_REGISTRY) {
    const queueName = queueNameForCategory(def.category);

    await prisma.scheduledJob.upsert({
      where: { name: def.name },
      create: {
        name: def.name,
        category: def.category,
        queueName,
        cronPattern: def.cronPattern,
        timezone: def.timezone,
        priority: def.priority,
        maxRetries: def.maxRetries,
        retryDelayMs: def.retryDelayMs,
        timeoutMs: def.timeoutMs,
        description: def.description,
        status: 'SCHEDULED',
      },
      update: {
        category: def.category,
        queueName,
        cronPattern: def.cronPattern,
        timezone: def.timezone,
        priority: def.priority,
        maxRetries: def.maxRetries,
        retryDelayMs: def.retryDelayMs,
        timeoutMs: def.timeoutMs,
        description: def.description,
      },
    });

    if (!queues.has(queueName)) {
      const queue = new Queue(queueName, { connection: createQueueConnection() });
      const worker = new Worker(queueName, processor, { connection: createQueueConnection(), concurrency: WORKER_CONCURRENCY });
      worker.on('failed', (bullJob, err) => {
        logger.error('Scheduler job attempt failed', { queue: queueName, job: bullJob?.name, error: err.message });
      });
      queues.set(queueName, { queue, worker, category: def.category });
    }
  }

  const jobRows = await prisma.scheduledJob.findMany();
  for (const row of jobRows) {
    const def = registryByName.get(row.name);
    if (!def) continue; // a row for a job type removed from the registry — left alone, not auto-deleted
    if (row.status === 'PAUSED' || row.status === 'CANCELLED') continue;
    // eslint-disable-next-line no-await-in-loop -- one-time boot sequence over ~25 jobs, not a hot path
    await registerRepeatable(def, row.queueName);
  }

  logger.info(`Scheduler engine started — ${JOB_REGISTRY.length} jobs across ${queues.size} queues`);
}

export async function stopScheduler(): Promise<void> {
  for (const entry of queues.values()) {
    // eslint-disable-next-line no-await-in-loop -- shutdown sequence, order doesn't matter and there are only 6 queues
    await entry.worker.close();
    // eslint-disable-next-line no-await-in-loop
    await entry.queue.close();
  }
  queues.clear();
}

function requireJob(name: string): JobDefinition {
  const def = registryByName.get(name);
  if (!def) throw new NotFoundError(`Unknown job: ${name}`);
  return def;
}

export async function triggerJob(name: string, triggeredBy: string): Promise<void> {
  const def = requireJob(name);
  const row = await prisma.scheduledJob.findUnique({ where: { name } });
  if (!row) throw new NotFoundError(`Unknown job: ${name}`);
  const entry = queues.get(row.queueName);
  if (!entry) throw new NotFoundError(`Queue not initialized for job: ${name}`);
  await entry.queue.add(def.name, { trigger: 'MANUAL' satisfies JobTriggerType, triggeredBy }, jobOptions(def));
}

export async function retryFailedJob(name: string, triggeredBy: string): Promise<void> {
  const def = requireJob(name);
  const row = await prisma.scheduledJob.findUnique({ where: { name } });
  if (!row) throw new NotFoundError(`Unknown job: ${name}`);
  const lastFailed = await prisma.jobExecution.findFirst({ where: { jobId: row.id, status: 'FAILED' }, orderBy: { startedAt: 'desc' } });
  if (!lastFailed) throw new ValidationError('This job has no failed execution to retry.');
  const entry = queues.get(row.queueName);
  if (!entry) throw new NotFoundError(`Queue not initialized for job: ${name}`);
  await entry.queue.add(def.name, { trigger: 'RETRY' satisfies JobTriggerType, triggeredBy }, { ...jobOptions(def), attempts: 1 });
}

export async function pauseJob(name: string): Promise<void> {
  const def = requireJob(name);
  const row = await prisma.scheduledJob.findUnique({ where: { name } });
  if (!row) throw new NotFoundError(`Unknown job: ${name}`);
  await removeRepeatable(def, row.queueName);
  await prisma.scheduledJob.update({ where: { name }, data: { isPaused: true, status: 'PAUSED', nextRunAt: null } });
}

export async function resumeJob(name: string): Promise<void> {
  const def = requireJob(name);
  const row = await prisma.scheduledJob.findUnique({ where: { name } });
  if (!row) throw new NotFoundError(`Unknown job: ${name}`);
  await registerRepeatable(def, row.queueName);
  await prisma.scheduledJob.update({ where: { name }, data: { isPaused: false, status: 'SCHEDULED' } });
}

/** Stronger than pause: also purges this job's already-queued (not yet started) instances. `resumeJob` reactivates a cancelled job just like a paused one. */
export async function cancelJob(name: string): Promise<void> {
  const def = requireJob(name);
  const row = await prisma.scheduledJob.findUnique({ where: { name } });
  if (!row) throw new NotFoundError(`Unknown job: ${name}`);
  await removeRepeatable(def, row.queueName);

  const entry = queues.get(row.queueName);
  if (entry) {
    const pending = await entry.queue.getJobs(['waiting', 'delayed']);
    for (const pendingJob of pending.filter((j) => j.name === name)) {
      // eslint-disable-next-line no-await-in-loop -- purging a small, bounded backlog for one job name
      await pendingJob.remove();
    }
  }
  await prisma.scheduledJob.update({ where: { name }, data: { isPaused: true, status: 'CANCELLED', nextRunAt: null } });
}

export interface QueueStatus {
  queueName: string;
  category: JobDefinition['category'];
  isPaused: boolean;
  counts: Record<string, number>;
}

export async function getQueueStatuses(): Promise<QueueStatus[]> {
  const statuses: QueueStatus[] = [];
  for (const [queueName, entry] of queues.entries()) {
    // eslint-disable-next-line no-await-in-loop -- only 6 queues total
    const [counts, isPaused] = await Promise.all([
      entry.queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed'),
      entry.queue.isPaused(),
    ]);
    statuses.push({ queueName, category: entry.category, isPaused, counts });
  }
  return statuses;
}

function requireQueue(queueName: string): QueueEntry {
  const entry = queues.get(queueName);
  if (!entry) throw new NotFoundError(`Unknown queue: ${queueName}`);
  return entry;
}

export async function retryQueue(queueName: string): Promise<number> {
  const entry = requireQueue(queueName);
  const failed = await entry.queue.getFailed();
  for (const failedJob of failed) {
    // eslint-disable-next-line no-await-in-loop -- an admin-triggered, infrequent bulk action
    await failedJob.retry();
  }
  return failed.length;
}

/** Empties the waiting/delayed backlog only — leaves failed/completed history intact (that's what "Get Job History"/"Get Failed Jobs" read from). */
export async function clearQueue(queueName: string): Promise<void> {
  const entry = requireQueue(queueName);
  await entry.queue.drain(true);
}

export async function pauseQueue(queueName: string): Promise<void> {
  await requireQueue(queueName).queue.pause();
}

export async function resumeQueue(queueName: string): Promise<void> {
  await requireQueue(queueName).queue.resume();
}

export function listQueueNames(): string[] {
  return [...queues.keys()];
}

export function isKnownJob(name: string): boolean {
  return registryByName.has(name);
}
