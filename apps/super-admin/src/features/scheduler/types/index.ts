export type JobCategory = 'MEMBERSHIP' | 'ATTENDANCE' | 'PAYMENT' | 'NOTIFICATION' | 'REPORT' | 'MAINTENANCE';

export type JobRunStatus = 'PENDING' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PAUSED';

export type JobTriggerType = 'SCHEDULED' | 'MANUAL' | 'RETRY';

export interface ScheduledJob {
  id: string;
  name: string;
  category: JobCategory;
  queueName: string;
  cronPattern: string;
  timezone: string;
  status: JobRunStatus;
  isPaused: boolean;
  priority: number;
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  lastRunAt: string | null;
  lastStatus: JobRunStatus | null;
  nextRunAt: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobExecution {
  id: string;
  jobId: string;
  jobName: string;
  status: JobRunStatus;
  trigger: JobTriggerType;
  attempt: number;
  tenantId: string | null;
  triggeredBy: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  result: Record<string, unknown> | null;
  error: string | null;
}

export interface ScheduledJobDetail extends ScheduledJob {
  recentExecutions: JobExecution[];
}

export interface QueueStatus {
  queueName: string;
  category: JobCategory;
  isPaused: boolean;
  counts: Record<string, number>;
}

export interface SchedulerDashboard {
  runningJobs: number;
  scheduledJobs: number;
  failedJobs: number;
  pausedJobs: number;
  queueSize: number;
  queueHealth: 'healthy' | 'degraded' | 'unhealthy';
  workerStatus: QueueStatus[];
  avgProcessingTimeMs: number;
  successRate: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
